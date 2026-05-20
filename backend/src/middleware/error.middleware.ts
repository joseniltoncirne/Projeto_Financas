import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  // Erros de validação Zod
  if (error instanceof ZodError) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Validation Error',
      issues: error.flatten().fieldErrors,
    })
  }

  // Erros do Prisma
  const prismaCode = (error as { code?: string }).code
  if (prismaCode === 'P2002') {
    return reply.status(409).send({
      statusCode: 409,
      error: 'Conflict',
      message: 'Registro duplicado',
    })
  }
  if (prismaCode === 'P2025') {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Registro não encontrado',
    })
  }

  // Erros com statusCode explícito (lançados pelos services)
  const statusCode = (error as { statusCode?: number }).statusCode ?? error.statusCode
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return reply.status(statusCode).send({
      statusCode,
      error: error.name || 'Error',
      message: error.message,
    })
  }

  // Erros inesperados
  reply.log.error(error)
  return reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'Erro interno no servidor',
  })
}
