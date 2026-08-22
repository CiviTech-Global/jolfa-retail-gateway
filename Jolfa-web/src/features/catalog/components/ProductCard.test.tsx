import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ProductCard } from './ProductCard'
import { makeProduct } from '@/test/fixtures'
import { FALLBACK_IMAGE_URL } from '@/lib/utils'
import type { ProductDto } from '../types'

function renderCard(product: ProductDto) {
  return render(
    <MemoryRouter>
      <ProductCard product={product} />
    </MemoryRouter>,
  )
}

describe('ProductCard — content', () => {
  it('renders the title and links to the product detail page', () => {
    const product = makeProduct({ title: 'زعفران سرگل', slug: 'saffron' })

    renderCard(product)

    expect(screen.getByRole('heading', { name: 'زعفران سرگل' })).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links.every((link) => link.getAttribute('href') === '/products/saffron')).toBe(true)
  })

  it('renders the short description when present', () => {
    renderCard(makeProduct({ shortDescription: 'کیفیت ممتاز' }))

    expect(screen.getByText('کیفیت ممتاز')).toBeInTheDocument()
  })

  it('omits the description block entirely when it is null', () => {
    renderCard(makeProduct({ shortDescription: null, title: 'بدون توضیح' }))

    expect(screen.getByRole('heading', { name: 'بدون توضیح' })).toBeInTheDocument()
    expect(screen.queryByText('کیفیت ممتاز')).not.toBeInTheDocument()
  })

  it('gives the add-to-cart button an accessible product-specific label', () => {
    renderCard(makeProduct({ title: 'گردو' }))

    expect(screen.getByRole('button', { name: 'افزودن گردو به سبد خرید' })).toBeInTheDocument()
  })
})

describe('ProductCard — imagery', () => {
  it('uses the image flagged isPrimary', () => {
    const product = makeProduct({
      images: [
        { url: '/secondary.jpg', altText: null, sortOrder: 1, isPrimary: false },
        { url: '/primary.jpg', altText: null, sortOrder: 0, isPrimary: true },
      ],
    })

    renderCard(product)

    expect(screen.getByRole('img')).toHaveAttribute('src', '/primary.jpg')
  })

  it('falls back to the first image when none is flagged primary', () => {
    const product = makeProduct({
      images: [
        { url: '/first.jpg', altText: null, sortOrder: 0, isPrimary: false },
        { url: '/second.jpg', altText: null, sortOrder: 1, isPrimary: false },
      ],
    })

    renderCard(product)

    expect(screen.getByRole('img')).toHaveAttribute('src', '/first.jpg')
  })

  it('falls back to the placeholder when the product has no images', () => {
    renderCard(makeProduct({ images: [] }))

    expect(screen.getByRole('img')).toHaveAttribute('src', FALLBACK_IMAGE_URL)
  })

  it('always gives the image alt text (the product title), never an empty alt', () => {
    renderCard(makeProduct({ title: 'پسته اکبری', images: [] }))

    expect(screen.getByRole('img')).toHaveAttribute('alt', 'پسته اکبری')
  })

  it('lazy-loads the image', () => {
    renderCard(makeProduct())

    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy')
  })
})

describe('ProductCard — discount badge', () => {
  it('shows the badge and struck-through price when compareAtPrice is higher', () => {
    renderCard(makeProduct({ price: 75_000, compareAtPrice: 100_000 }))

    // 25% off. Note the badge interpolates a raw JS number, so the digits are
    // ASCII here even though prices elsewhere are formatted with fa-IR digits.
    expect(screen.getByText('٪25−')).toBeInTheDocument()
    // Both the sale price and the original are rendered.
    expect(screen.getAllByText(/تومان/)).toHaveLength(2)
  })

  it('hides the badge when compareAtPrice is null', () => {
    renderCard(makeProduct({ price: 75_000, compareAtPrice: null }))

    expect(screen.getAllByText(/تومان/)).toHaveLength(1)
  })

  it('hides the badge when compareAtPrice is LOWER than the price', () => {
    renderCard(makeProduct({ price: 100_000, compareAtPrice: 80_000 }))

    expect(screen.getAllByText(/تومان/)).toHaveLength(1)
  })

  it('hides the badge when compareAtPrice EQUALS the price', () => {
    renderCard(makeProduct({ price: 100_000, compareAtPrice: 100_000 }))

    expect(screen.getAllByText(/تومان/)).toHaveLength(1)
  })

  it('renders without a discount badge for a RelatedProductDto, which has no compareAtPrice', () => {
    // Related products come from a narrower select on the server.
    const related = {
      id: 'related-1',
      title: 'محصول مرتبط',
      slug: 'related-1',
      price: 50_000,
      shortDescription: null,
      images: [],
    }

    render(
      <MemoryRouter>
        <ProductCard product={related} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'محصول مرتبط' })).toBeInTheDocument()
    expect(screen.getAllByText(/تومان/)).toHaveLength(1)
  })
})
