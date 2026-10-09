# LovelyBar

Web shop nội bộ nhỏ: React + TypeScript + Tailwind (frontend), Go + Gin + PostgreSQL (backend).

- Khách vào `/`, admin vào `/admin` và đăng nhập bằng Supabase Auth.
- Admin có thể đăng bài kèm tối đa 20 ảnh (mỗi ảnh tối đa 2 MB), sửa, ẩn/hiện và xóa bài viết; người dùng xem bài đang hiển thị tại `/posts`.
- Người đọc có thể reaction và bình luận không cần đăng nhập; bình luận hiển thị dưới tên “Khách”, người đăng có thể sửa/xóa từ trình duyệt đã đăng, admin cũng có thể xóa.
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
Các thay đổi trong `supabase/migrations` áp dụng qua Supabase CLI bằng `npx supabase db push`.

Hoặc chạy cả API + DB: `docker compose up --build`.

## Cấu hình thanh toán (Supabase Edge Function)

```env
PAYMENT_BANK_CODE=BIDV
PAYMENT_BANK_ACCOUNT=1440250089
PAYMENT_BANK_NAME=Phan Thanh Hậu
# PAYMENT_BANK_BIN=970418       # chỉ đặt nếu cần ghi đè BIN
```

Đặt các giá trị production bằng lệnh sau (hoặc tại Supabase Dashboard →
Edge Functions → Secrets). Chỉ có **một** tài khoản nhận tiền. Các secrets không nằm
trong frontend; riêng số tài khoản được nhúng trong payload QR để ngân hàng biết nơi
chuyển tiền. Ảnh QR được dựng ngay trong trình duyệt, không gửi payload tới dịch vụ tạo
QR bên thứ ba.

```bash
npx supabase secrets set PAYMENT_BANK_CODE=BIDV PAYMENT_BANK_ACCOUNT=1440250089 "PAYMENT_BANK_NAME=Phan Thanh Hậu"
```

Tên ngân hàng và chủ tài khoản được hiển thị cạnh QR; tên chủ tài khoản hiển thị cả
dạng in hoa và dạng có dấu. Cập nhật secrets hiện dùng trước khi deploy Edge Function.

### Việc bạn PHẢI làm trước khi dùng thật

1. **Quét thử mã QR bằng app ngân hàng thật.** Test đơn vị chỉ chứng minh payload đúng định dạng (số tiền, CRC),
   không thay thế được bước này. Kiểm tra app tự điền đúng tài khoản, số tiền và nội dung.
2. Đối chiếu mã BIN với danh sách chính thức
   (https://api.vietqr.io/v2/banks) hoặc đặt `PAYMENT_BANK_BIN`.
3. Sau khi thay code Edge Function, deploy lại bằng `npx supabase functions deploy payment-qr`.

## Cách tính tiền và QR

```text
Frontend gửi:  [{productId, quantity}]            (không gửi giá, tổng, hay amount)
Backend:       lấy giá từ DB -> tính subtotal -> tổng -> lưu order + snapshot tên/giá
QR:            Edge Function nhận orderCode -> đọc orders.total_amount -> trả payload;
               frontend tạo ảnh QR cục bộ trong trình duyệt
```

Giá bán còn 80% giá gốc (giảm 20%) từ 18:40 đến trước 07:00 theo giờ Việt Nam.
Giá được tính lại ở máy chủ khi tạo đơn; danh sách sản phẩm và giỏ hàng hiển thị
giá gốc gạch ngang cùng nhãn `SALE -20%` trong khung giờ ưu đãi.

Mã đơn mới có dạng `LB20261003001` (ngày theo giờ Việt Nam + số thứ tự trong ngày), đồng thời là nội dung chuyển khoản. Mã của các đơn đã tạo trước khi đổi định dạng vẫn được giữ nguyên.
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

## Quyền admin

Frontend dùng Supabase Auth để đăng nhập; Row Level Security chỉ cho tài khoản có
`app_metadata.role = 'admin'` thao tác dữ liệu quản trị. Bài đăng được đọc công khai,
nhưng chỉ admin mới được tạo, sửa, ẩn/hiện hoặc xóa theo migrations
`supabase/migrations/007_posts.sql`, `supabase/migrations/008_post_visibility.sql` và
`supabase/migrations/009_post_image.sql`, `supabase/migrations/010_post_images.sql` và
`supabase/migrations/011_post_image_limit.sql`, `supabase/migrations/012_post_interactions.sql` và
`supabase/migrations/013_guest_comment_edit_tokens.sql` bổ sung mã sửa/xóa bình luận cho khách.
Nếu dùng backend Go riêng, các route `/api/admin` hiện chưa có xác thực; cần bảo vệ chúng
trước khi công khai backend ra internet.

Khác: không commit `.env`; backend kiểm tra lại mọi input (frontend chỉ để tiện dùng);
ảnh upload được kiểm tra theo nội dung thật (JPG/PNG/WEBP, tối đa 2 MB).

## Triển khai (kiểm tra lại giá và hạn mức hiện tại trước khi chọn)

| Thành phần                                 | Gợi ý                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Frontend (`npm run build`, thư mục `dist`) | Cloudflare Pages, Vercel, Netlify; đặt `VITE_API_URL` và `FRONTEND_ORIGIN`                                    |
| Backend                                    | Một VPS nhỏ chạy Docker Compose (rẻ, đơn giản); hoặc Render/Fly.io/Railway                                    |
| PostgreSQL                                 | Cùng VPS, hoặc Neon / Supabase                                                                                |
| Ảnh                                        | MVP: đĩa cục bộ (`UPLOAD_DIR`, nhớ gắn volume). Sau này: viết thêm một `storage.Storage` cho Cloudflare R2/S3 |

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
