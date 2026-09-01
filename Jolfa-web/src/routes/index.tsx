import { Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { ScrollToTop } from '@/components/layout/ScrollToTop'
import { RouteError } from '@/components/layout/RouteError'
import { RouteFallback } from '@/components/layout/RouteFallback'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AdminRoute } from '@/components/layout/AdminRoute'
import { GuestRoute } from '@/components/layout/GuestRoute'
import { StaticPageGuard } from '@/components/layout/StaticPageGuard'
import { HomePage } from '@/features/catalog/pages/HomePage'
import { NotFoundPage } from './pages'

/**
 * Every screen below the landing page is a separate chunk.
 *
 * The whole application used to ship as one 1.5 MB script, so an anonymous
 * shopper opening the home page downloaded the entire admin panel — charts,
 * data tables, editors — before anything rendered. Splitting per route means a
 * visitor pays only for the screens they actually open.
 *
 * `HomePage` and the layouts stay eager on purpose: they are needed for the
 * first paint on the most common entry point, and lazy-loading them would just
 * add a network round trip in front of it.
 */
// Generic over the module so the export name is checked against what the file
// actually exports, while tolerating sibling exports that take their own props.
function lazyRoute<M extends object, K extends keyof M>(load: () => Promise<M>, name: K) {
  return {
    lazy: async () => {
      const module = await load()
      return { Component: module[name] as React.ComponentType }
    },
  }
}

const rootChildren: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },

      // --- storefront ---
      {
        path: 'products',
        ...lazyRoute(() => import('@/features/catalog/pages/ProductListPage'), 'ProductListPage'),
      },
      {
        path: 'products/:slug',
        ...lazyRoute(
          () => import('@/features/catalog/pages/ProductDetailPage'),
          'ProductDetailPage',
        ),
      },
      {
        path: 'categories',
        ...lazyRoute(() => import('@/features/catalog/pages/CategoriesPage'), 'CategoriesPage'),
      },
      {
        path: 'categories/:slug',
        ...lazyRoute(() => import('@/features/catalog/pages/CategoryPage'), 'CategoryPage'),
      },
      {
        path: 'search',
        ...lazyRoute(() => import('@/features/catalog/pages/SearchPage'), 'SearchPage'),
      },
      {
        path: 'cart',
        ...lazyRoute(() => import('@/features/cart/pages/CartPage'), 'CartPage'),
      },
      {
        path: 'checkout',
        element: <ProtectedRoute><Outlet /></ProtectedRoute>,
        children: [
          {
            index: true,
            ...lazyRoute(() => import('@/features/checkout/pages/CheckoutPage'), 'CheckoutPage'),
          },
        ],
      },
      {
        path: 'payment/callback',
        ...lazyRoute(
          () => import('@/features/orders/pages/PaymentCallbackPage'),
          'PaymentCallbackPage',
        ),
      },

      // --- auth ---
      {
        path: 'login',
        element: <GuestRoute><Outlet /></GuestRoute>,
        children: [
          { index: true, ...lazyRoute(() => import('@/features/auth/pages/LoginPage'), 'LoginPage') },
        ],
      },
      {
        path: 'register',
        element: <GuestRoute><Outlet /></GuestRoute>,
        children: [
          {
            index: true,
            ...lazyRoute(() => import('@/features/auth/pages/RegisterPage'), 'RegisterPage'),
          },
        ],
      },
      {
        path: 'forgot-password',
        element: <GuestRoute><Outlet /></GuestRoute>,
        children: [
          {
            index: true,
            ...lazyRoute(
              () => import('@/features/auth/pages/ForgotPasswordPage'),
              'ForgotPasswordPage',
            ),
          },
        ],
      },

      // --- customer panel: same shell for every account screen, mirroring /admin ---
      {
        path: 'profile',
        element: <ProtectedRoute><Outlet /></ProtectedRoute>,
        children: [
          {
            path: '',
            lazy: async () => {
              const { AccountLayout } = await import('@/components/layout/AccountLayout')
              return { Component: AccountLayout }
            },
            children: [
              {
                index: true,
                ...lazyRoute(() => import('@/features/user/pages/UserDashboardPage'), 'UserDashboardPage'),
              },
              {
                path: 'orders',
                ...lazyRoute(() => import('@/features/orders/pages/OrdersPage'), 'OrdersPage'),
              },
              {
                path: 'orders/:id',
                ...lazyRoute(
                  () => import('@/features/orders/pages/OrderDetailPage'),
                  'OrderDetailPage',
                ),
              },
              {
                path: 'addresses',
                ...lazyRoute(() => import('@/features/addresses/pages/AddressesPage'), 'AddressesPage'),
              },
              {
                path: 'edit',
                ...lazyRoute(() => import('@/features/auth/pages/ProfileEditPage'), 'ProfileEditPage'),
              },
              {
                path: 'security',
                ...lazyRoute(
                  () => import('@/features/auth/pages/AccountSecurityPage'),
                  'AccountSecurityPage',
                ),
              },
              { path: '*', element: <Navigate to="/profile" replace /> },
            ],
          },
        ],
      },

      // --- static pages ---
      {
        path: 'about',
        element: <StaticPageGuard settingKey="show_about"><Outlet /></StaticPageGuard>,
        children: [
          { index: true, ...lazyRoute(() => import('@/features/static/pages/AboutPage'), 'AboutPage') },
        ],
      },
      {
        path: 'contact',
        element: <StaticPageGuard settingKey="show_contact"><Outlet /></StaticPageGuard>,
        children: [
          {
            index: true,
            ...lazyRoute(() => import('@/features/static/pages/ContactPage'), 'ContactPage'),
          },
        ],
      },
      {
        path: 'rules',
        element: <StaticPageGuard settingKey="show_rules"><Outlet /></StaticPageGuard>,
        children: [
          { index: true, ...lazyRoute(() => import('@/features/static/pages/RulesPage'), 'RulesPage') },
        ],
      },

      // Eager on purpose: StaticPageGuard imports NotFoundPage directly, so it
      // is already in the entry chunk and a dynamic import here would only add
      // a bundler warning without splitting anything.
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  // --- admin ---
  // Entirely lazy, including the layout: nothing here should ever reach a
  // shopper's browser. This is where recharts and the heaviest tables live.
  {
    path: '/admin',
    element: <AdminRoute><Outlet /></AdminRoute>,
    errorElement: <RouteError />,
    children: [
      {
        path: '',
        lazy: async () => {
          const { AdminLayout } = await import('@/components/layout/AdminLayout')
          return { Component: AdminLayout }
        },
        children: [
          {
            index: true,
            ...lazyRoute(() => import('@/features/admin/pages/AdminDashboardPage'), 'AdminDashboardPage'),
          },
          {
            path: 'products',
            ...lazyRoute(() => import('@/features/admin/pages/AdminProductsPage'), 'AdminProductsPage'),
          },
          // The product editor is a dialog over the list; these keep working as
          // deep links and render the list with the dialog already open.
          {
            path: 'products/new',
            ...lazyRoute(() => import('@/features/admin/pages/AdminProductsPage'), 'AdminProductsPage'),
          },
          {
            path: 'products/:slug/edit',
            ...lazyRoute(() => import('@/features/admin/pages/AdminProductsPage'), 'AdminProductsPage'),
          },
          {
            path: 'categories',
            ...lazyRoute(
              () => import('@/features/admin/pages/AdminCategoriesPage'),
              'AdminCategoriesPage',
            ),
          },
          {
            path: 'orders',
            ...lazyRoute(() => import('@/features/admin/pages/AdminOrdersPage'), 'AdminOrdersPage'),
          },
          {
            path: 'orders/:id',
            ...lazyRoute(
              () => import('@/features/admin/pages/AdminOrderDetailPage'),
              'AdminOrderDetailPage',
            ),
          },
          {
            path: 'banners',
            ...lazyRoute(() => import('@/features/admin/pages/AdminBannersPage'), 'AdminBannersPage'),
          },
          {
            path: 'users',
            ...lazyRoute(() => import('@/features/admin/pages/AdminUsersPage'), 'AdminUsersPage'),
          },
          {
            path: 'payments',
            ...lazyRoute(() => import('@/features/admin/pages/AdminPaymentsPage'), 'AdminPaymentsPage'),
          },
          {
            path: 'transactions',
            ...lazyRoute(
              () => import('@/features/admin/pages/AdminTransactionsPage'),
              'AdminTransactionsPage',
            ),
          },
          {
            path: 'activity-log',
            ...lazyRoute(
              () => import('@/features/admin/pages/AdminActivityLogPage'),
              'AdminActivityLogPage',
            ),
          },
          {
            path: 'homepage-sections',
            ...lazyRoute(
              () => import('@/features/cms/pages/AdminHomepageSectionsPage'),
              'AdminHomepageSectionsPage',
            ),
          },
          {
            path: 'settings',
            ...lazyRoute(() => import('@/features/cms/pages/AdminSettingsPage'), 'AdminSettingsPage'),
          },
          {
            path: 'demo',
            ...lazyRoute(() => import('@/features/cms/pages/AdminDemoDataPage'), 'AdminDemoDataPage'),
          },
          { path: '*', element: <Navigate to="/admin" replace /> },
        ],
      },
    ],
  },
]

/**
 * Wraps both route trees so behaviour that belongs to *every* navigation —
 * resetting scroll, showing a loader while a chunk downloads, catching a render
 * error — is declared once rather than per layout.
 */
export const routes: RouteObject[] = [
  {
    element: (
      <>
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </>
    ),
    errorElement: <RouteError />,
    children: rootChildren,
  },
]

export const router = createBrowserRouter(routes)
