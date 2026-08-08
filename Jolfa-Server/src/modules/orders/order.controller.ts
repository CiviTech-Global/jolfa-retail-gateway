import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../shared/reply.js";
import { asyncHandler } from "../../shared/async-handler.js";
import * as orderService from "./order.service.js";
import type { OrderCreateBody, OrderListQuery, OrderParams, OrderStatusUpdateBody } from "./order.types.js";

export const createOrder = asyncHandler(
  async (
    request: FastifyRequest<{ Body: OrderCreateBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const user = request.user;
    const result = await orderService.createOrder(user.id, request.body);
    sendSuccess(reply, result, 201);
  }
);

export const listUserOrders = asyncHandler(
  async (
    request: FastifyRequest<{ Querystring: OrderListQuery }>,
    reply: FastifyReply
  ): Promise<void> => {
    const user = request.user;
    const result = await orderService.listUserOrders(user.id, request.query);
    sendSuccess(reply, result);
  }
);

export const getOrderById = asyncHandler(
  async (
    request: FastifyRequest<{ Params: OrderParams }>,
    reply: FastifyReply
  ): Promise<void> => {
    const user = request.user;
    const result = await orderService.getOrderById(request.params.id, user.id, user.role);
    sendSuccess(reply, result);
  }
);

export const listAdminOrders = asyncHandler(
  async (
    request: FastifyRequest<{ Querystring: OrderListQuery }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await orderService.listAdminOrders(request.query);
    sendSuccess(reply, result);
  }
);

export const updateOrderStatus = asyncHandler(
  async (
    request: FastifyRequest<{ Params: OrderParams; Body: OrderStatusUpdateBody }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await orderService.updateOrderStatus(request.params.id, request.body);
    sendSuccess(reply, result);
  }
);
