import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { ScrollToTop } from '@/components/layout/ScrollToTop'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { AccountLayout } from '@/components/layout/AccountLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AdminRoute } from '@/components/layout/AdminRoute'
import { GuestRoute } from '@/components/layout/GuestRoute'
import { StaticPageGuard } from '@/components/layout/StaticPageGuard'
import { HomePage } from '@/features/catalog/pages/HomePage'
import { CategoriesPage } from '@/features/catalog/pages/CategoriesPage'
import { CategoryPage } from '@/features/catalog/pages/CategoryPage'
import { ProductListPage } from '@/features/catalog/pages/ProductListPage'
import { ProductDetailPage } from '@/features/catalog/pages/ProductDetailPage'
import { SearchPage } from '@/features/catalog/pages/SearchPage'
import { CartPage } from '@/features/cart/pages/CartPage'
import { CheckoutPage } from '@/features/checkout/pages/CheckoutPage'
import { PaymentCallbackPage } from '@/features/orders/pages/PaymentCallbackPage'
import { OrdersPage } from '@/features/orders/pages/OrdersPage'
import { OrderDetailPage } from '@/features/orders/pages/OrderDetailPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { AccountSecurityPage } from '@/features/auth/pages/AccountSecurityPage'
import { ProfileEditPage } from '@/features/auth/pages/ProfileEditPage'
import { AboutPage } from '@/features/static/pages/AboutPage'
import { ContactPage } from '@/features/static/pages/ContactPage'
import { RulesPage } from '@/features/static/pages/RulesPage'
import { NotFoundPage } from './pages'
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage'
import { AdminOrdersPage } from '@/features/admin/pages/AdminOrdersPage'
import { AdminOrderDetailPage } from '@/features/admin/pages/AdminOrderDetailPage'
import { AdminProductsPage } from '@/features/admin/pages/AdminProductsPage'
import { AdminCategoriesPage } from '@/features/admin/pages/AdminCategoriesPage'
import { AdminBannersPage } from '@/features/admin/pages/AdminBannersPage'
import { AdminUsersPage } from '@/features/admin/pages/AdminUsersPage'
import { AdminPaymentsPage } from '@/features/admin/pages/AdminPaymentsPage'
import { AdminTransactionsPage } from '@/features/admin/pages/AdminTransactionsPage'
import { AdminActivityLogPage } from '@/features/admin/pages/AdminActivityLogPage'
import { AdminSettingsPage } from '@/features/cms/pages/AdminSettingsPage'
import { AdminHomepageSectionsPage } from '@/features/cms/pages/AdminHomepageSectionsPage'
import { AdminDemoDataPage } from '@/features/cms/pages/AdminDemoDataPage'
import { UserDashboardPage } from '@/features/user/pages/UserDashboardPage'
import { AddressesPage } from '@/features/addresses/pages/AddressesPage'

/**
 * Wraps both route trees so behaviour that belongs to *every* navigation —
 * currently resetting scroll — is declared once rather than per layout.
 */
const rootChildren: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products', element: <ProductListPage /> },
      { path: 'products/:slug', element: <ProductDetailPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'categories/:slug', element: <CategoryPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <ProtectedRoute><CheckoutPage /></ProtectedRoute> },
      { path: 'payment/callback', element: <PaymentCallbackPage /> },
      { path: 'login', element: <GuestRoute><LoginPage /></GuestRoute> },
      { path: 'register', element: <GuestRoute><RegisterPage /></GuestRoute> },
      { path: 'forgot-password', element: <GuestRoute><ForgotPasswordPage /></GuestRoute> },
      {
        // Customer panel: same shell for every account screen, mirroring /admin.
        path: 'profile',
        element: (
          <ProtectedRoute>
            <AccountLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <UserDashboardPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'orders/:id', element: <OrderDetailPage /> },
          { path: 'addresses', element: <AddressesPage /> },
          { path: 'edit', element: <ProfileEditPage /> },
          { path: 'security', element: <AccountSecurityPage /> },
          { path: '*', element: <Navigate to="/profile" replace /> },
        ],
      },
      { path: 'about', element: <StaticPageGuard settingKey="show_about"><AboutPage /></StaticPageGuard> },
      { path: 'contact', element: <StaticPageGuard settingKey="show_contact"><ContactPage /></StaticPageGuard> },
      { path: 'rules', element: <StaticPageGuard settingKey="show_rules"><RulesPage /></StaticPageGuard> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminRoute><AdminLayout /></AdminRoute>,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'products', element: <AdminProductsPage /> },
      // The product editor is a dialog over the list; these keep working as
      // deep links and render the list with the dialog already open.
      { path: 'products/new', element: <AdminProductsPage /> },
      { path: 'products/:slug/edit', element: <AdminProductsPage /> },
      { path: 'categories', element: <AdminCategoriesPage /> },
      { path: 'orders', element: <AdminOrdersPage /> },
      { path: 'orders/:id', element: <AdminOrderDetailPage /> },
      { path: 'banners', element: <AdminBannersPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'payments', element: <AdminPaymentsPage /> },
      { path: 'transactions', element: <AdminTransactionsPage /> },
      { path: 'activity-log', element: <AdminActivityLogPage /> },
      { path: 'homepage-sections', element: <AdminHomepageSectionsPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
      { path: 'demo', element: <AdminDemoDataPage /> },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
]

export const routes: RouteObject[] = [
  {
    element: (
      <>
        <ScrollToTop />
        <Outlet />
      </>
    ),
    children: rootChildren,
  },
]

export const router = createBrowserRouter(routes)
