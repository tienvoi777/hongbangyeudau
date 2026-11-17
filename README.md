# THPT Hồng Bàng – Ký ức 3D

Trò chơi 3D tham quan lại trường THPT Hồng Bàng (Hải Phòng). Nhiều người có thể vào cùng lúc để gặp nhau, chat, vẫy tay và cùng viết sổ lưu bút.

## Các file

| File | Dùng để |
|---|---|
| `index.html` | Toàn bộ game |
| `map.jpg` | Ảnh vệ tinh làm nền mặt bằng |
| `nhac-truong.mp3` | Nhạc phát qua loa trường |
| `server.js` | Máy chủ: mở game và nối mọi người với nhau |
| `package.json` | Khai báo thư viện cần cài cho máy chủ (`ws`) |
| `data/luubut.json` | Sổ lưu bút. Tự tạo khi có người viết đầu tiên |

## Cách 1: chơi một mình (như trước)

Mở `index.html` bằng Live Server trong VS Code. Game chạy bình thường, chỉ không có người khác. Chat và lưu bút khi đó chỉ lưu trên máy bạn.

## Cách 2: chơi cùng bạn bè chung Wi-Fi

1. Cài **Node.js** bản LTS từ https://nodejs.org (chỉ cần cài một lần).
2. Mở Terminal trong thư mục game (trong VS Code: Terminal → New Terminal), chạy:
   ```
   npm install
   node server.js
   ```
3. Mở trình duyệt vào **http://localhost:3000**.
4. Bạn bè dùng chung Wi-Fi mở **http://ĐỊA-CHỈ-IP-MÁY-BẠN:3000**.
   Để xem IP trên Windows: mở Command Prompt, gõ `ipconfig`, lấy dòng *IPv4 Address* (thường dạng `192.168.x.x`).
   Nếu bạn bè không vào được, hãy cho phép Node.js qua Windows Firewall khi Windows hỏi.

Muốn dừng máy chủ thì bấm `Ctrl + C` trong Terminal.

## Cách 3: đưa lên Internet miễn phí (Render.com)

1. Tạo một repository trên GitHub rồi đưa toàn bộ thư mục game lên. **Không** cần đưa thư mục `node_modules`, vì file `.gitignore` đã loại nó ra.
2. Vào https://render.com, đăng nhập bằng GitHub, chọn **New → Web Service**, rồi chọn repository vừa tạo.
3. Điền như sau:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
4. Bấm **Create Web Service**. Vài phút sau bạn có đường link dạng `https://ten-cua-ban.onrender.com`. Gửi link này cho các HBer là mọi người vào cùng một trường.

Lưu ý về gói miễn phí của Render:
- Máy chủ "ngủ" sau khoảng 15 phút không có ai. Người đầu tiên vào lại phải đợi khoảng một phút.
- **Sổ lưu bút có thể bị mất** mỗi khi máy chủ khởi động lại hoặc bạn cập nhật code, vì ổ đĩa của gói miễn phí không được giữ lại. Muốn giữ lâu dài thì thêm một **Disk** trong Render (có phí), gắn vào ví dụ `/var/data`, rồi đặt biến môi trường `DATA_DIR=/var/data`. Bạn cũng nên thỉnh thoảng tải file `data/luubut.json` về để sao lưu.

## Dùng máy chủ ở nơi khác

Nếu game nằm một nơi (ví dụ GitHub Pages) còn máy chủ ở nơi khác, mở game với đường dẫn:
```
index.html?server=wss://ten-may-chu.onrender.com/hb-ws
```

## Trong game

- **Enter:** chat. Lời nói hiện thành bong bóng trên đầu nhân vật.
- **1:** vẫy tay. **2:** nhảy. Hai động tác này cũng có nút trên thanh trên cùng.
- **Lưu bút:** bấm nút trên thanh trên cùng, hoặc đến bục *Sổ lưu bút* trước Tòa 1 rồi nhấn **E**.
- Thanh trên cùng hiện "Trực tuyến · N người" khi đang ở chung máy chủ, hoặc "Chơi một mình".

## Giới hạn để máy chủ an toàn

- Tối đa 80 người cùng lúc.
- Tin chat dài tối đa 200 ký tự, mỗi tin cách nhau ít nhất 0,7 giây.
- Lời lưu bút dài tối đa 500 ký tự, mỗi người viết cách nhau ít nhất 20 giây. Sổ giữ 3000 lời gần nhất.
- Máy chủ chỉ phát các file của game (html, ảnh, nhạc), không phát `server.js` hay dữ liệu trong `data/`.
