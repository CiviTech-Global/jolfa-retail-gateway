import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { UnauthorizedError } from "../../shared/app-error.js";
import * as addressService from "./address.service.js";
import type { AddressCreateBody, AddressParams, AddressUpdateBody } from "./address.types.js";

/** Every route here is behind `authenticate`, so this only narrows the type. */
function requireUserId(request: FastifyRequest): string {
  const id = request.user?.id;
  if (!id) {
    throw new UnauthorizedError("ابتدا وارد حساب کاربری خود شوید");
  }
  return id;
}

export const listAddresses = asyncHandler(
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await addressService.listAddresses(requireUserId(request));
    sendSuccess(reply, result);
  }
);

export const getAddress = asyncHandler(
  async (
    request: FastifyRequest<{ Params: AddressParams }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await addressService.getAddress(requireUserId(request), request.params.id);
    sendSuccess(reply, result);
  }
);

export const createAddress = asyncHandler(
  async (
    request: FastifyRequest<{ Body: AddressCreateBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await addressService.createAddress(requireUserId(request), request.body);
    sendSuccess(reply, result, 201);
  }
);

export const updateAddress = asyncHandler(
  async (
    request: FastifyRequest<{ Params: AddressParams; Body: AddressUpdateBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await addressService.updateAddress(
      requireUserId(request),
      request.params.id,
      request.body
    );
    sendSuccess(reply, result);
  }
);

export const setDefaultAddress = asyncHandler(
  async (
    request: FastifyRequest<{ Params: AddressParams }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await addressService.setDefaultAddress(requireUserId(request), request.params.id);
    sendSuccess(reply, result);
  }
);

export const deleteAddress = asyncHandler(
  async (
    request: FastifyRequest<{ Params: AddressParams }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await addressService.deleteAddress(requireUserId(request), request.params.id);
    sendSuccess(reply, result);
  }
);
