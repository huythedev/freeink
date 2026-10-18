# FreeInk user guide / Hướng dẫn sử dụng FreeInk

**Languages:** English · Tiếng Việt. Click **EN / VI** in the top-right corner to change the interface language. The setting is saved locally; handwritten notes and titles remain unchanged.

## Tiếng Việt

### 1. Tạo và quản lý ghi chú

- Nhấn nút **+** hoặc `Ctrl/⌘ + N` để tạo ghi chú, đặt tên và chọn mẫu giấy.
- Mở thư viện (biểu tượng menu) để tìm kiếm, đổi tên, nhân bản hoặc xóa ghi chú.
- Nhấn **Thêm trang** để thêm trang mới. Đổi mẫu giấy bằng nút **Giấy**.
- Nội dung tự động lưu trên thiết bị bằng IndexedDB. **Đây không phải đồng bộ đám mây.**

### 2. Viết tay và chỉnh sửa

- **Làm mượt khi đang viết:** nét bút hiển thị theo sau ngòi bút khoảng 24 ms để giảm rung. Đầu bút vừa nhấc lên thì nét hoàn tất ngay. Vào **Tùy chọn ghi chú → Làm mượt nét bút** để bật/tắt. Bút hỗ trợ áp lực và độ nghiêng nếu bút/driver và trình duyệt cung cấp dữ liệu.

- Dùng chuột, màn hình cảm ứng hoặc bút cảm ứng; chọn bút mực, bút chì, bút đánh dấu, tẩy, khoanh chọn, hình dạng, văn bản hoặc bàn tay.
- Nhấn nút **Tẩy** để chọn **Xóa đối tượng** hoặc **Tẩy từng phần** trong cùng một menu. Phím **E** dùng chế độ đã chọn; **Shift+E** chọn tẩy từng phần. Xóa đối tượng xóa toàn bộ nét; tẩy từng phần chỉ xóa vùng đầu tẩy đi qua, kể cả trên hình, chữ và ảnh. Thanh độ dày đổi kích thước tẩy; có thể hoàn tác/làm lại.
- Dùng bảng màu và thanh độ dày nét bút. Nhấn ô màu tùy chỉnh rồi kéo bảng màu và thanh sắc màu để đổi màu mực trực tiếp, hoặc nhập mã hex. Các phím mũi tên chỉnh độ bão hòa/độ sáng; giữ Shift để chỉnh nhanh hơn.
- Khoanh chọn (Lasso) cho phép di chuyển, sao chép đối tượng và thay đổi kích thước ảnh.
- Công cụ thước hiện chỉ là thước minh họa, chưa có chức năng hút nét theo thước.

### 3. Nhập tệp và dán

- Nhấn **Nhập tệp** để mở ảnh (PNG/JPEG/WebP), PDF, DOCX hoặc ghi chú `.freeink`.
- Bản cài EXE/MSI đăng ký đuôi `.freeink` với Windows. Nhấp đúp để mở bản sao có thể sửa trong cửa sổ FreeInk đang chạy. Nội dung tự lưu trong ứng dụng; xuất lại `.freeink` để cập nhật tệp sao lưu ban đầu. Nếu Windows đã chọn ứng dụng mặc định khác, dùng **Open with → FreeInk**.
- Dán ảnh chụp màn hình bằng `Ctrl/⌘ + V` hoặc thả ảnh vào trang.
- PDF nhập được chuyển thành nền ảnh cho từng trang; nét chú thích mới vẫn chỉnh sửa được. Độ nét nền phụ thuộc độ phân giải khi nhập.
- DOCX nhập thành văn bản chỉnh sửa được nhưng không đảm bảo giữ nguyên bố cục Word phức tạp.
- Tác vụ nhập/xuất có nút **Hủy** hoặc phím `Escape`. Khi hủy nhập, tài liệu đang mở không bị thay bằng phần nhập dở.
- Bản HTML chạy độc lập không hỗ trợ nhập PDF/DOCX; cần cài bản desktop có dependencies.

### 4. Xuất tệp và sao lưu

- **Xuất tệp → PDF vector:** nét bút và hình dạng là vector, không bị vỡ khi phóng to; ảnh nhập vẫn là ảnh raster.
- **PNG:** xuất trang hiện tại thành ảnh, độ phân giải cố định.
- **FreeInk (.freeink):** lưu bản sao chỉnh sửa được. Nên sao lưu thường xuyên trước khi gỡ ứng dụng, chuyển máy hoặc xóa dữ liệu.

### 5. Cập nhật và quyền riêng tư

- Windows EXE (NSIS) có thể kiểm tra và cài đặt bản mới qua nút **Cập nhật**.
- Windows MSI cần cài phiên bản MSI mới bằng Windows Installer.
- Bản macOS ký và công chứng có thể sử dụng hệ thống cập nhật desktop; bản Mac thử nghiệm chưa ký thì không thể tự cập nhật.
- Ghi chú nằm cục bộ, không cần tài khoản và không được tự gửi lên máy chủ.

### Phím tắt

| Chức năng | Phím |
|---|---|
| Bút mực / Bút chì / Đánh dấu | `P` / `K` / `H` |
| Tẩy / Khoanh chọn / Hình dạng / Văn bản | `E` / `L` / `S` / `T` |
| Tẩy từng phần | `Shift + E` |
| Di chuyển trang | Giữ `Space` |
| Lưu / Ghi chú mới | `Ctrl/⌘ + S` / `Ctrl/⌘ + N` |
| Hoàn tác / Làm lại | `Ctrl/⌘ + Z` / `Ctrl/⌘ + Shift + Z` |
| Nhân bản vùng chọn | `Ctrl/⌘ + D` |
| Hướng dẫn trong ứng dụng | Nút **Hướng dẫn** hoặc `?` |

## English

### 1. Notes and pages

Click **+** or `Ctrl/⌘ + N` to create a note. Choose paper templates and use the gallery to find, rename, duplicate, or delete notes. **Add page** extends the document. Notes auto-save on this device; there is no cloud synchronization.

### 2. Handwriting tools

- **Live stroke stabilization:** ink trails stylus input by about 24 ms to reduce jitter while writing, then immediately catches up on pen-up. Toggle under **Note options → Stroke stabilization**. Compatible pens supply variable pressure and tilt to shape the stroke.

Use your mouse, touch, or stylus with Pen, Pencil, Highlighter, Eraser, Lasso, Shape, or Text. Click **Eraser** to choose **Object eraser** or **Pixel eraser** in one menu. **E** uses the remembered mode; **Shift+E** selects Pixel eraser. Object erasing removes an entire element; pixel erasing removes only the area you touch, including on shapes, text and images. The width slider adjusts the pixel eraser size; both modes support undo/redo. Open the custom color swatch to drag the color field and hue slider for live ink color changes, or enter a hex value. Arrow keys fine-tune saturation/brightness; hold Shift for larger steps. Use Lasso to select, move, duplicate, or resize inserted images. The visual ruler does not currently snap ink.

### 3. Paste and import

Use **Import** for PNG/JPEG/WebP, PDF, DOCX, or editable `.freeink` backups. Paste an image with `Ctrl/⌘ + V` or drag images onto a page. PDFs are rasterized as page backgrounds; newly drawn ink remains editable. DOCX is converted to editable text and images but complex Word layout is not faithfully preserved. Use **Cancel** or `Escape` to stop file work; cancelled imports do not replace the current note with a partial document. Standalone HTML does not support PDF/DOCX import.

Windows EXE/MSI installers register `.freeink` files. Double-click to import an editable local copy into the existing FreeInk window. Edits auto-save inside the app; export again to update the original backup file. If another default was previously selected in Windows, choose **Open with → FreeInk**.

### 4. Export and backups

**Export → Vector PDF** keeps handwriting and drawn shapes sharp at any zoom. Embedded images and scanned PDF backgrounds are still rasterized. **PNG** exports a raster current page. **.freeink** is the editable backup format; export backups before uninstalling or switching devices.

### 5. Updates and privacy

The Windows NSIS EXE supports in-app GitHub updates; MSI installers are upgraded by Windows Installer. Signed and notarized macOS builds can use the desktop updater; unsigned Mac test builds cannot. All notes are stored locally without a required account.

### Keyboard shortcuts

`P` Pen · `K` Pencil · `H` Highlighter · `E` Eraser (remembered mode) · `Shift+E` Pixel eraser · `L` Lasso · `S` Shape · `T` Text · Hold `Space` Pan · `Ctrl/⌘ + Z` Undo · `Ctrl/⌘ + Shift + Z` Redo · `Ctrl/⌘ + N` New · `Ctrl/⌘ + S` Save · `Ctrl/⌘ + D` Duplicate · `?` Guide.

Pixel-erased backups require a FreeInk release with pixel eraser support. / Bản sao lưu đã tẩy từng phần cần phiên bản FreeInk hỗ trợ tính năng này.
