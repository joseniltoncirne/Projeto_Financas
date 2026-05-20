import { prisma } from '../lib/prisma.js'

export const userRepository = {
  findByCpf(cpf: string) {
    return prisma.user.findUnique({ where: { cpf } })
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } })
  },

  create(data: { name: string; cpf: string; passwordHash: string }) {
    return prisma.user.create({ data })
  },
}
