import { prisma } from "../../shared/prisma.js";
import { ConflictError, NotFoundError } from "../../shared/app-error.js";
import type { AddressCreateBody, AddressUpdateBody } from "./address.types.js";

/**
 * The address book holds only entries the user explicitly saved (`isSaved`).
 * Checkout also writes an address row per order as an immutable snapshot; those
 * are deliberately invisible here, otherwise the book would grow by one entry
 * on every purchase.
 */
const bookWhere = (userId: string) => ({ userId, isSaved: true });

export async function listAddresses(userId: string) {
  const addresses = await prisma.address.findMany({
    where: bookWhere(userId),
    // Default first, then most recently added.
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return { addresses };
}

/** Loads one book entry, failing the same way for "missing" and "not yours". */
export async function getAddress(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({
    where: { id: addressId, ...bookWhere(userId) },
  });

  if (!address) {
    throw new NotFoundError("Address");
  }

  return { address };
}

export async function createAddress(userId: string, data: AddressCreateBody) {
  const existingCount = await prisma.address.count({ where: bookWhere(userId) });
  // The first address has to be the default — there is nothing else to fall
  // back to at checkout.
  const isDefault = existingCount === 0 ? true : data.isDefault === true;

  const address = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.address.updateMany({
        where: { ...bookWhere(userId), isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.address.create({
      data: { ...data, userId, isDefault, isSaved: true },
    });
  });

  return { address };
}

export async function updateAddress(userId: string, addressId: string, data: AddressUpdateBody) {
  const { address: existing } = await getAddress(userId, addressId);

  const address = await prisma.$transaction(async (tx) => {
    if (data.isDefault === true) {
      await tx.address.updateMany({
        where: { ...bookWhere(userId), isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    return tx.address.update({
      where: { id: existing.id },
      // Clearing the default flag directly would leave the user with none, so
      // the only way to move it is to promote another address.
      data: { ...data, isDefault: data.isDefault === true ? true : existing.isDefault },
    });
  });

  return { address };
}

export async function setDefaultAddress(userId: string, addressId: string) {
  await getAddress(userId, addressId);

  const address = await prisma.$transaction(async (tx) => {
    await tx.address.updateMany({
      where: { ...bookWhere(userId), isDefault: true },
      data: { isDefault: false },
    });

    return tx.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  });

  return { address };
}

export async function deleteAddress(userId: string, addressId: string) {
  const { address } = await getAddress(userId, addressId);

  // Orders reference their address with onDelete: Restrict. A book entry that
  // was used directly by an order would raise a raw FK error, so explain it.
  const orderCount = await prisma.order.count({ where: { shippingAddressId: addressId } });
  if (orderCount > 0) {
    throw new ConflictError("این آدرس در یک سفارش استفاده شده و قابل حذف نیست");
  }

  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id: addressId } });

    // Removing the default leaves the book without one; promote the newest.
    if (address.isDefault) {
      const next = await tx.address.findFirst({
        where: bookWhere(userId),
        orderBy: { createdAt: "desc" },
      });
      if (next) {
        await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
  });

  return { success: true };
}
