# FreeInk user guide / Hướng dẫn sử dụng FreeInk

**Languages:** English · Tiếng Việt. Click **EN / VI** in the top-right corner to change the interface language. The setting is saved locally; handwritten notes and titles remain unchanged.

## Tiếng Việt

### 1. Tạo và quản lý ghi chú

- Nhấn nút **+** hoặc `Ctrl/⌘ + N` để tạo ghi chú, đặt tên và chọn mẫu giấy.
- Mở thư viện (biểu tượng menu) để tìm kiếm, đổi tên, nhân bản hoặc xóa ghi chú.
- Nhấn **Thêm trang** để thêm trang mới. Đổi mẫu giấy bằng nút **Giấy**.
- Nội dung tự động lưu trên thiết bị bằng IndexedDB. **Đây không phải đồng bộ đám mây.**

### 2. Viết tay và chỉnh sửa

- Dùng chuột, màn hình cảm ứng hoặc bút cảm ứng; chọn bút mực, bút chì, bút đánh dấu, tẩy, khoanh chọn, hình dạng, văn bản hoặc bàn tay.
- Dùng bảng màu và thanh độ dày nét bút.
- Khoanh chọn (Lasso) cho phép di chuyển, sao chép đối tượng và thay đổi kích thước ảnh.
- Công cụ thước hiện chỉ là thước minh họa, chưa có chức năng hút nét theo thước.

### 3. Nhập tệp và dán

- Nhấn **Nhập tệp** để mở ảnh (PNG/JPEG/WebP), PDF, DOCX hoặc ghi chú `.freeink`.
- Dán ảnh chụp màn hình bằng `Ctrl/⌘ + V` hoặc thả ảnh vào trang.
- PDF nhập được chuyển thành nền ảnh cho từng trang; nét chú thích mới vẫn chỉnh sửa được. Độ nét nền phụ thuộc độ phân giải khi nhập.
- DOCX nhập thành văn bản chỉnh sửa được nhưng không đảm bảo giữ nguyên bố cục Word phức tạp.
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
| Di chuyển trang | Giữ `Space` |
| Lưu / Ghi chú mới | `Ctrl/⌘ + S` / `Ctrl/⌘ + N` |
| Hoàn tác / Làm lại | `Ctrl/⌘ + Z` / `Ctrl/⌘ + Shift + Z` |
| Nhân bản vùng chọn | `Ctrl/⌘ + D` |
| Hướng dẫn trong ứng dụng | Nút **Hướng dẫn** hoặc `?` |

## English

### 1. Notes and pages

Click **+** or `Ctrl/⌘ + N` to create a note. Choose paper templates and use the gallery to find, rename, duplicate, or delete notes. **Add page** extends the document. Notes auto-save on this device; there is no cloud synchronization.

### 2. Handwriting tools

Use your mouse, touch, or stylus with Pen, Pencil, Highlighter, Eraser, Lasso, Shape, or Text. Adjust ink color and stroke thickness. Use Lasso to select, move, duplicate, or resize inserted images. The visual ruler does not currently snap ink.

### 3. Paste and import

Use **Import** for PNG/JPEG/WebP, PDF, DOCX, or editable `.freeink` backups. Paste an image with `Ctrl/⌘ + V` or drag images onto a page. PDFs are rasterized as page backgrounds; newly drawn ink remains editable. DOCX is converted to editable text and images but complex Word layout is not faithfully preserved. Standalone HTML does not support PDF/DOCX import.

### 4. Export and backups

**Export → Vector PDF** keeps handwriting and drawn shapes sharp at any zoom. Embedded images and scanned PDF backgrounds are still rasterized. **PNG** exports a raster current page. **.freeink** is the editable backup format; export backups before uninstalling or switching devices.

### 5. Updates and privacy

The Windows NSIS EXE supports in-app GitHub updates; MSI installers are upgraded by Windows Installer. Signed and notarized macOS builds can use the desktop updater; unsigned Mac test builds cannot. All notes are stored locally without a required account.

### Keyboard shortcuts

`P` Pen · `K` Pencil · `H` Highlighter · `E` Eraser · `L` Lasso · `S` Shape · `T` Text · Hold `Space` Pan · `Ctrl/⌘ + Z` Undo · `Ctrl/⌘ + Shift + Z` Redo · `Ctrl/⌘ + N` New · `Ctrl/⌘ + S` Save · `Ctrl/⌘ + D` Duplicate · `?` Guide.
