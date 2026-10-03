# LovelyBar

Web shop nội bộ nhỏ: React + TypeScript + Tailwind (frontend), Go + Gin + PostgreSQL (backend).

- Khách vào `/`, admin vào `/admin`. **Không có đăng nhập.**
- Không có tồn kho: mua số lượng bất kỳ (1 đến 9999 mỗi sản phẩm).
- Giỏ hàng chỉ nằm trong bộ nhớ trình duyệt (refresh là mất, có chủ đích).
- Thanh toán: chuyển khoản qua **VietQR**. Hệ thống chỉ **tạo QR**, **không biết** tiền đã về hay chưa.
  Admin tự mở app ngân hàng, tìm mã đơn (`LB...`) trong nội dung chuyển khoản. Không có trạng thái PAID.

## Chạy thử

Cần: Go, Node 20+, PostgreSQL (hoặc Docker).

```bash
# 1. Database + API
cp backend/.env.example backend/.env      # sửa PAYMENT_BANK_* thành tài khoản thật
docker compose up -d db
cd backend
go mod tidy                               # lần đầu: tải thư viện, tạo go.sum
go test ./...
go run ./cmd/server                       # http://localhost:8080

# 2. Frontend (terminal khác)
cd frontend
npm install
npm run dev                               # http://localhost:5173  (admin: /admin)
```

`SEED_SAMPLE=true` sẽ thêm 4 sản phẩm mẫu khi bảng trống. Migration chạy tự động khi API khởi động.

Hoặc chạy cả API + DB: `docker compose up --build`.

## Cấu hình thanh toán (`backend/.env`)

```env
PAYMENT_BANK_CODE=VCB          # VCB MB BIDV TCB ACB CTG VPB TPB STB VIB HDB SHB MSB OCB LPB VBA
PAYMENT_BANK_ACCOUNT=123456789
PAYMENT_BANK_NAME=LOVELYBAR
# PAYMENT_BANK_BIN=            # chỉ cần nếu ngân hàng không có trong danh sách
```

Chỉ có **một** tài khoản nhận tiền. Các biến này chỉ ở backend; frontend chỉ nhận
`{type, code, name}` của phương thức thanh toán.

### Việc bạn PHẢI làm trước khi dùng thật

1. **Quét thử mã QR bằng app ngân hàng thật.** Test đơn vị chỉ chứng minh payload đúng định dạng (số tiền, CRC),
   không thay thế được bước này. Kiểm tra app tự điền đúng tài khoản, số tiền và nội dung.
2. Đối chiếu mã BIN trong `backend/internal/payment/banks.go` với danh sách chính thức
   (https://api.vietqr.io/v2/banks) hoặc đặt `PAYMENT_BANK_BIN`.

## Cách tính tiền và QR

```text
Frontend gửi:  [{productId, quantity}]            (không gửi giá, tổng, hay amount)
Backend:       lấy giá từ DB -> tính subtotal -> tổng -> lưu order + snapshot tên/giá
QR:            POST /api/payment/qr {orderCode}   -> backend đọc order.totalAmount -> tạo VietQR
```

Mã đơn dạng `LB20261003001` (ngày theo giờ Việt Nam + số thứ tự trong ngày), đồng thời là nội dung chuyển khoản.
URL và API công khai dùng `orderCode`, không dùng id số.

## API

```text
Public   GET  /api/products, /api/products/:id, /api/payment/methods, /api/orders/:code
         POST /api/orders, /api/payment/qr           (giới hạn 30 request/phút/IP)
Admin    GET  /api/admin/dashboard
         GET/POST /api/admin/products   GET/PUT/DELETE /api/admin/products/:id
         POST/DELETE /api/admin/products/:id/image
         GET  /api/admin/orders[?status=]   GET /api/admin/orders/:id
         PUT  /api/admin/orders/:id/status
```

Response: `{success: true, data}` hoặc `{success: false, message}`.

## Cảnh báo bảo mật: `/admin` KHÔNG được bảo vệ

Bất kỳ ai truy cập được URL đều sửa được sản phẩm, đơn hàng và upload ảnh. Chỉ dùng trong mạng nội bộ.
Nếu đưa lên internet, hãy thêm một lớp bảo vệ *trước* khi mở: Cloudflare Access, HTTP Basic Auth ở reverse proxy,
IP allowlist hoặc đăng nhập admin. Hiện chưa làm các mục này.

Khác: không commit `.env`; backend kiểm tra lại mọi input (frontend chỉ để tiện dùng);
ảnh upload được kiểm tra theo nội dung thật (JPG/PNG/WEBP, tối đa 2 MB).

## Triển khai (kiểm tra lại giá và hạn mức hiện tại trước khi chọn)

| Thành phần | Gợi ý |
|---|---|
| Frontend (`npm run build`, thư mục `dist`) | Cloudflare Pages, Vercel, Netlify; đặt `VITE_API_URL` và `FRONTEND_ORIGIN` |
| Backend | Một VPS nhỏ chạy Docker Compose (rẻ, đơn giản); hoặc Render/Fly.io/Railway |
| PostgreSQL | Cùng VPS, hoặc Neon / Supabase |
| Ảnh | MVP: đĩa cục bộ (`UPLOAD_DIR`, nhớ gắn volume). Sau này: viết thêm một `storage.Storage` cho Cloudflare R2/S3 |

Lưu ý: nếu backend chạy sau reverse proxy, cấu hình trusted proxies của Gin để rate limit thấy đúng IP khách.

## Cấu trúc

```text
backend/  cmd/server  migrations  internal/{handler,service,repository,model,routes,payment,storage,middleware,config}
frontend/ src/{components,pages,layouts,services,hooks,types,utils,store}
```

Thêm phương thức thanh toán mới: cài `payment.Provider` và đăng ký trong `cmd/server/main.go`.

## Tính năng tương lai (chưa làm)

Đăng nhập admin, tự xác nhận thanh toán qua webhook ngân hàng (SePay/Casso...), MoMo (cần tài khoản merchant),
giỏ hàng lưu lại, thông báo đơn mới, thống kê doanh thu, quản lý tồn kho.
