import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import { renderSection, sectionRegistry, SECTION_TYPE_OPTIONS } from './section-registry'
import type { HomepageSectionDto } from './types'
import { makeCategory, makeProduct } from '@/test/fixtures'

// Every data-driven section reaches the network through this module.
vi.mock('@/features/catalog/api', () => ({
  getCategories: vi.fn(),
  getProducts: vi.fn(),
}))

const catalogApi = await import('@/features/catalog/api')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function renderElement(element: ReactElement | null) {
  return render(<>{element}</>, { wrapper })
}

function makeSection(overrides: Partial<HomepageSectionDto> = {}): HomepageSectionDto {
  return {
    id: 'section-1',
    key: 'section-key',
    title: 'عنوان بخش',
    type: 'trust_badges',
    config: {},
    displayOrder: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(catalogApi.getCategories).mockResolvedValue({ categories: [makeCategory()] })
  vi.mocked(catalogApi.getProducts).mockResolvedValue({
    products: [makeProduct()],
    meta: { page: 1, limit: 24, total: 1, totalPages: 1 },
  })
})

describe('renderSection() dispatch', () => {
  it('returns null for an unknown section type instead of throwing', () => {
    expect(renderSection(makeSection({ type: 'no_such_type' }))).toBeNull()
  })

  it('returns null for an empty type string', () => {
    expect(renderSection(makeSection({ type: '' }))).toBeNull()
  })

  it('renders an element for every registered type', () => {
    for (const type of Object.keys(sectionRegistry)) {
      expect(renderSection(makeSection({ type })), `type ${type}`).not.toBeNull()
    }
  })

  it('covers every canonical admin dropdown option with a renderer', () => {
    for (const option of SECTION_TYPE_OPTIONS) {
      expect(sectionRegistry[option.value], `option ${option.value}`).toBeTypeOf('function')
    }
  })

  it('keeps the legacy type aliases registered so old seeded data still renders', () => {
    for (const legacy of [
      'hero',
      'categories',
      'featured_products',
      'new_products',
      'discounted',
      'promo_banner',
    ]) {
      expect(sectionRegistry[legacy], `legacy ${legacy}`).toBeTypeOf('function')
    }
  })

  it('gives each rendered section a React key derived from the section id', () => {
    const element = renderSection(makeSection({ id: 'abc-123', type: 'trust_badges' }))

    expect(element?.key).toBe('abc-123')
  })
})

/**
 * The core resilience contract for this whole config-driven layer: a section
 * whose config is empty, malformed, or the wrong shape must degrade to an
 * empty render — never throw and blank the homepage (there is no global
 * ErrorBoundary; see known-gaps §11).
 */
describe('every section type survives a hostile config', () => {
  // `banners` matters as much as the rest: HeroCarouselSection and
  // BannerGridSection both read that key, so omitting it would leave the two
  // most prominent homepage sections untested against a bad config.
  const ARRAY_KEYS = ['slides', 'items', 'badges', 'brands', 'posts', 'banners'] as const

  function eachKey(value: unknown): Record<string, unknown> {
    return Object.fromEntries(ARRAY_KEYS.map((key) => [key, value]))
  }

  const hostileConfigs: [string, Record<string, unknown>][] = [
    ['empty object', {}],
    ['null-valued keys', eachKey(null)],
    ['string-valued keys', eachKey('nope')],
    ['number-valued keys', eachKey(42)],
    ['boolean-valued keys', eachKey(true)],
    ['object-valued keys', eachKey({ not: 'an array' })],
    ['empty arrays', eachKey([])],
    ['array of empty objects', eachKey([{}])],
    ['array of nulls', eachKey([null])],
  ]

  for (const type of Object.keys(sectionRegistry)) {
    for (const [label, config] of hostileConfigs) {
      it(`${type} renders without throwing given a ${label} config`, () => {
        expect(() => renderElement(renderSection(makeSection({ type, config })))).not.toThrow()
      })
    }
  }
})

describe('TrustBadgesSection', () => {
  it('renders one card per configured badge', () => {
    renderElement(
      renderSection(
        makeSection({
          type: 'trust_badges',
          config: {
            badges: [
              { icon: 'Truck', title: 'ارسال سریع', description: 'در سراسر کشور' },
              { icon: 'ShieldCheck', title: 'ضمانت اصالت', description: 'کالای اصل' },
            ],
          },
        }),
      ),
    )

    expect(screen.getByText('ارسال سریع')).toBeInTheDocument()
    expect(screen.getByText('در سراسر کشور')).toBeInTheDocument()
    expect(screen.getByText('ضمانت اصالت')).toBeInTheDocument()
  })

  it('falls back to a default icon for an unrecognised icon name', () => {
    expect(() =>
      renderElement(
        renderSection(
          makeSection({
            type: 'trust_badges',
            config: { badges: [{ icon: 'NotARealIcon', title: 'با آیکن نامعتبر' }] },
          }),
        ),
      ),
    ).not.toThrow()

    expect(screen.getByText('با آیکن نامعتبر')).toBeInTheDocument()
  })

  it('renders a badge with no title or description as empty text, not "undefined"', () => {
    renderElement(
      renderSection(makeSection({ type: 'trust_badges', config: { badges: [{}] } })),
    )

    expect(screen.queryByText('undefined')).not.toBeInTheDocument()
  })
})

describe('BrandStripSection', () => {
  it('renders a logo image when the brand has one', () => {
    renderElement(
      renderSection(
        makeSection({
          type: 'brand_strip',
          config: { brands: [{ name: 'برند الف', logo: '/brand-a.png' }] },
        }),
      ),
    )

    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', '/brand-a.png')
    expect(image).toHaveAttribute('alt', 'برند الف')
  })

  it('falls back to the brand name as text when there is no logo', () => {
    renderElement(
      renderSection(
        makeSection({ type: 'brand_strip', config: { brands: [{ name: 'برند بی‌لوگو' }] } }),
      ),
    )

    expect(screen.getByText('برند بی‌لوگو')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('links a brand to its configured target, defaulting to /products', () => {
    renderElement(
      renderSection(
        makeSection({
          type: 'brand_strip',
          config: {
            brands: [
              { name: 'با لینک', link: '/categories/x' },
              { name: 'بدون لینک' },
            ],
          },
        }),
      ),
    )

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/categories/x')
    expect(links[1]).toHaveAttribute('href', '/products')
  })

  it('renders nothing at all when there are no brands', () => {
    const { container } = renderElement(
      renderSection(makeSection({ type: 'brand_strip', config: { brands: [] } })),
    )

    expect(container).toBeEmptyDOMElement()
  })
})

describe('data-driven sections', () => {
  it('category_grid requests categories and renders them', async () => {
    renderElement(renderSection(makeSection({ type: 'category_grid', config: {} })))

    expect(catalogApi.getCategories).toHaveBeenCalled()
    expect(await screen.findByRole('link')).toBeInTheDocument()
  })

  it('product_carousel requests products', () => {
    renderElement(renderSection(makeSection({ type: 'product_carousel', config: {} })))

    expect(catalogApi.getProducts).toHaveBeenCalled()
  })

  it('featured_products narrows the carousel to the featured filter', () => {
    renderElement(renderSection(makeSection({ type: 'featured_products', config: {} })))

    expect(catalogApi.getProducts).toHaveBeenCalled()
  })

  it('survives the catalog request failing outright', async () => {
    vi.mocked(catalogApi.getProducts).mockRejectedValue(new Error('network down'))

    expect(() =>
      renderElement(renderSection(makeSection({ type: 'product_carousel', config: {} }))),
    ).not.toThrow()
  })

  it('survives the categories request failing outright', () => {
    vi.mocked(catalogApi.getCategories).mockRejectedValue(new Error('network down'))

    expect(() =>
      renderElement(renderSection(makeSection({ type: 'category_grid', config: {} }))),
    ).not.toThrow()
  })

  it('survives a catalog response with an empty product list', () => {
    vi.mocked(catalogApi.getProducts).mockResolvedValue({
      products: [],
      meta: { page: 1, limit: 24, total: 0, totalPages: 0 },
    })

    expect(() =>
      renderElement(renderSection(makeSection({ type: 'flash_deals', config: {} }))),
    ).not.toThrow()
  })
})
