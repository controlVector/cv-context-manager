import 'fastify'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      user_id: string
      workspace_id: string
      [key: string]: any
    }
    user: {
      user_id: string
      workspace_id: string
      [key: string]: any
    }
  }
}