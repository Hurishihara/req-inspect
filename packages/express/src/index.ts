import type { RequestHandler } from 'express'
import { createInspector, type InspectorOptions } from '@req-inspect/core'

export type { InspectorOptions }

const stripQuery = (url: string): string => {
  const q = url.indexOf('?')
  return q < 0 ? url : url.slice(0, q)
}

export const inspector = (options: InspectorOptions = {}): RequestHandler => {
  const insp = createInspector(options)
  return (req, res, next) => {
    switch (insp.dispatch(stripQuery(req.originalUrl))) {
      case 'handle':
        insp.handle(req, res)
        return
      case 'skip':
        next()
        return
      case 'capture':
        insp.capture(req, res, {
          route: () => {
            // req.route is undefined until Express matches a route, whatever its declared type says.
            const route = req.route as { path: unknown } | undefined
            return route ? `${req.baseUrl}${String(route.path)}` : null
          },
          params: () => ({ ...req.params }),
          query: () => req.query,
          body: (): unknown => req.body,
        })
        next()
    }
  }
}

export default inspector
