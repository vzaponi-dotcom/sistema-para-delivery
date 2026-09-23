import { createBrowserRouter, createMemoryRouter } from 'react-router'
import { NAVIGATION_DESTINATIONS } from './registry.js'

const routeHandle = (destinationId) => Object.freeze({ destinationId })

const destinationRoutes = NAVIGATION_DESTINATIONS.map(({ id, path }) => Object.freeze({
  id: `admin-destination:${id}`,
  path: path.replace(/^\//, ''),
  handle: routeHandle(id),
}))

function createAdminRouteObjects({ rootElement, rootComponent } = {}) {
  if (!rootElement && !rootComponent) {
    throw new Error('Admin router requires a persistent root element or component')
  }

  const root = {
    id: 'admin-root',
    path: '/',
    children: [
      ...destinationRoutes,
      Object.freeze({
        id: 'admin-unknown',
        path: '*',
        handle: routeHandle(null),
      }),
    ],
  }

  if (rootElement) root.element = rootElement
  else root.Component = rootComponent

  return [root]
}

export function createAdminBrowserRouter({ rootElement, rootComponent } = {}) {
  return createBrowserRouter(createAdminRouteObjects({ rootElement, rootComponent }))
}

export function createAdminMemoryRouter({
  rootElement,
  rootComponent,
  initialEntries = ['/'],
  initialIndex,
} = {}) {
  return createMemoryRouter(
    createAdminRouteObjects({ rootElement, rootComponent }),
    { initialEntries, initialIndex },
  )
}

export { createAdminRouteObjects }
