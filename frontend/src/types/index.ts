export type ProductStatus = 'AVAILABLE' | 'HIDDEN'
export type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'

export interface Product {
  id: number
  name: string
  description: string
  price: number
  image: string | null
  status: ProductStatus
  createdAt: string
  updatedAt: string
}

export interface ProductInput {
  name: string
  description: string
  price: number
  status: ProductStatus
}

export interface Post {
  id: number
  title: string
  content: string
  images: string[]
  isPublished: boolean
  createdAt: string
}

export interface PostInput {
  title: string
  content: string
  images: string[]
}

export interface PostComment {
  id: number
  author: string
  content: string
  createdAt: string
}

export interface PostInteractions {
  reactionCounts: Record<string, number>
  myReaction: string | null
  comments: PostComment[]
  commentCount: number
}

export interface OrderItem {
  id: number
  productId: number | null
  productName: string
  unitPrice: number
  quantity: number
  subtotal: number
}

export interface Order {
  id: number
  orderCode: string
  totalAmount: number
  paymentMethod: string
  orderStatus: OrderStatus
  createdAt: string
  updatedAt: string
  items: OrderItem[]
}

export interface PaymentMethod {
  type: string
  code: string
  name: string
}

export interface QRResult {
  orderId: number
  orderCode: string
  amount: number
  paymentMethod: string
  qrCode: string
  bankName?: string
  accountNumber?: string
  accountName?: string
}

export interface Stats {
  totalProducts: number
  totalOrders: number
  pendingOrders: number
  expectedRevenue: number
  recentOrders: Order[]
}

export interface SalesReportRow {
  periodStart: string
  totalOrders: number
  pendingOrders: number
  completedOrders: number
  expectedRevenue: number
  confirmedRevenue: number
}

export interface ProductSalesReportRow {
  productName: string
  quantitySold: number
  orderCount: number
  confirmedRevenue: number
}

export interface CartItem {
  productId: number
  name: string
  price: number
  image: string | null
  quantity: number
}
