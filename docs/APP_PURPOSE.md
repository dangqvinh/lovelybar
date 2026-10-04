# LovelyBar giải quyết những việc gì?

## Mục đích

LovelyBar là cửa hàng trực tuyến nhỏ dành cho nội bộ công ty. Ứng dụng giúp khách
xem sản phẩm, tạo đơn và chuyển khoản; đồng thời giúp quản trị viên quản lý sản phẩm,
đơn hàng và đối soát giao dịch.

## Việc khách hàng có thể làm

- Xem danh sách và chi tiết sản phẩm đang được bán.
- Chọn số lượng từng sản phẩm và quản lý giỏ hàng trong phiên sử dụng hiện tại.
- Tạo đơn hàng với mã đơn riêng, xem chi tiết đơn và tổng tiền.
- Nhận mã VietQR điền sẵn số tiền và mã đơn để chuyển khoản ngân hàng.
- Xem trạng thái đơn: đang chờ xử lý, hoàn tất hoặc đã hủy.

Giá và tổng tiền được tính ở cơ sở dữ liệu từ giá sản phẩm hiện hành. Tên sản phẩm
và đơn giá tại thời điểm đặt hàng được lưu thành bản chụp trong từng dòng đơn hàng,
để việc đổi giá hoặc xóa sản phẩm không làm thay đổi lịch sử đơn.

## Việc quản trị viên có thể làm

- Đăng nhập khu vực quản trị bằng tài khoản Supabase Auth đã được cấp quyền admin.
- Xem tổng quan số sản phẩm, số đơn, đơn đang chờ, doanh thu dự kiến và các đơn gần đây.
- Thêm, sửa, ẩn/hiện, xóa sản phẩm; tải lên, thay hoặc xóa ảnh sản phẩm.
- Xem danh sách và chi tiết đơn hàng; cập nhật trạng thái đơn sau khi kiểm tra giao dịch.
- Xem báo cáo số đơn, doanh thu dự kiến và doanh thu đã xác nhận theo ngày/tháng,
  trong khoảng thời gian tùy chọn.

Quyền quản trị được kiểm tra ở database, không chỉ dựa vào việc ẩn hoặc hiện route
trên giao diện.

## Quy tắc vận hành

- Không quản lý tồn kho. Mỗi sản phẩm có thể đặt từ 1 đến 9.999 đơn vị; một đơn có
  tối đa 50 loại sản phẩm khác nhau.
- Giỏ hàng chỉ nằm trong bộ nhớ frontend; tải lại trang hoặc đóng phiên có thể làm
  mất giỏ hàng chưa tạo đơn.
- Chỉ sản phẩm `AVAILABLE` được hiển thị và đặt mua. Sản phẩm `HIDDEN` bị từ chối
  khi tạo đơn.
- Mỗi đơn bắt đầu ở trạng thái `PENDING`. Tạo đơn hoặc sinh QR **không đồng nghĩa**
  với việc khách đã chuyển tiền hay cửa hàng đã nhận tiền.
- Cửa hàng tự kiểm tra giao dịch trong ứng dụng ngân hàng, đối chiếu số tiền và mã
  đơn trong nội dung chuyển khoản, rồi quản trị viên cập nhật trạng thái.
- QR chỉ hỗ trợ chuẩn bị thông tin chuyển khoản VietQR; ứng dụng không xác minh thanh
  toán và không có trạng thái `PAID`.
- Mã đơn dạng `LB` + ngày Việt Nam `YYYYMMDD` + số thứ tự trong ngày, ví dụ
  `LB20261003001`.
- Ứng dụng không thu thập thông tin người mua; không có tài khoản khách hàng, hồ sơ
  người mua, thanh toán qua cổng trung gian hay lưu trữ giỏ hàng lâu dài.

## Giới hạn cần biết

- Endpoint tạo đơn là public để khách không cần tài khoản. Vì vậy có thể bị gọi lặp
  hoặc spam; việc giới hạn số loại sản phẩm và số lượng không thay thế rate limiting
  hoặc CAPTCHA.
- Mã đơn tuần tự có thể bị đoán. Trang tra cứu theo mã đơn không chứa dữ liệu cá nhân,
  nhưng mã đơn vẫn không phải bí mật hay bằng chứng thanh toán.
- VietQR không xác nhận tiền đã vào tài khoản. Việc xác nhận hiện dựa trên đối soát
  thủ công của cửa hàng.
- Thông tin tài khoản nhận tiền nằm trong payload QR để ngân hàng định tuyến khoản
  chuyển. Chỉ cấu hình tài khoản mà chủ sở hữu chấp nhận chia sẻ với người thanh toán.
- Việc quét thử bằng ứng dụng ngân hàng thật vẫn cần thực hiện trước khi sử dụng thực tế.

## Luồng chính

```text
Khách chọn sản phẩm
  -> giỏ hàng tạm trong frontend
  -> database xác thực sản phẩm, đọc giá và tạo đơn PENDING
  -> Edge Function đọc tổng tiền của đơn và sinh payload VietQR
  -> trình duyệt tạo ảnh QR
  -> cửa hàng kiểm tra giao dịch ngân hàng thủ công
  -> admin cập nhật trạng thái đơn
```
