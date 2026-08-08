import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
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
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { AboutPage } from '@/features/static/pages/AboutPage'
import { ContactPage } from '@/features/static/pages/ContactPage'
import { RulesPage } from '@/features/static/pages/RulesPage'
import {
  AdminDashboardPage,
  AdminPlaceholderPage,
  NotFoundPage,
} from './pages'
import { AdminOrdersPage } from '@/features/admin/pages/AdminOrdersPage'
import { AdminProductsPage } from '@/features/admin/pages/AdminProductsPage'

export const routes: RouteObject[] = [
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
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'profile', element: <ProtectedRoute><OrdersPage /></ProtectedRoute> },
      { path: 'about', element: <AboutPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <ProtectedRoute><AdminLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'products', element: <AdminProductsPage /> },
      { path: 'products/new', element: <AdminPlaceholderPage title="محصول جدید" /> },
      { path: 'products/:id/edit', element: <AdminPlaceholderPage title="ویرایش محصول" /> },
      { path: 'categories', element: <AdminPlaceholderPage title="مدیریت دسته‌بندی‌ها" /> },
      { path: 'orders', element: <AdminOrdersPage /> },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
