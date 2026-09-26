# SEO và khả năng được tìm thấy trên Google

Cập nhật lần cuối: 2026-09-26. Tài liệu này ghi lại vì sao website không lên Google, những gì code đã sửa, và những việc **chỉ chủ site làm được** (Vercel, DNS, Google Search Console, Google Business Profile, nội dung CMS). Không có phần việc chủ site thì phần code không đủ để site được index lại.

## 1. Chẩn đoán (kiểm tra thực tế ngày 2026-09-23)

| Vấn đề                                                                                                                                                                                           | Hậu quả với Google                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` chưa đặt trên Vercel, nên **mọi** thẻ canonical, hreflang, `og:url`, dòng `Sitemap:` trong robots.txt và toàn bộ `<loc>` trong sitemap đều trỏ về `http://localhost:3000` | Google coi mọi trang là bản sao của một địa chỉ không truy cập được → không index. Đây là nguyên nhân chính.                                |
| Hai tên miền `reddoor.vn` và `www.lacquerwares.vn` (cộng alias `reddoor-lacquerwares.vercel.app`) cùng phục vụ một site, không redirect về một host                                              | Tín hiệu bị chia ba; Google chọn ngẫu nhiên bản để hiển thị (thực tế đang hiện "Lacquerwares" và "REDDOOR VIETNAM" như hai site khác nhau). |
| Bản deploy đang chạy (commit `f9c2c4e`, 20/09) chưa có JSON-LD, `og:image`, manifest; trang gốc `/` redirect 307 (tạm thời)                                                                      | Không có rich result, không có ảnh khi chia sẻ, link về tên miền gốc không được tính.                                                       |
| `src/app/[locale]/loading.tsx` bọc mọi trang public → slug không tồn tại trả **200** (soft 404) và bị cache                                                                                      | Search Console báo Soft 404; link cũ bị crawl mãi như trang sống.                                                                           |
| Không có link `<a>` nào tới các ngôn ngữ khác trong HTML (bộ chọn ngôn ngữ chỉ là listbox JS)                                                                                                    | 5/6 cây ngôn ngữ (en, fr, de, ja, zh-CN) không có đường crawl từ bất kỳ trang nào.                                                          |
| H1 trang chủ và tiêu đề các trang mục chỉ là ẩn dụ / một từ ("Sản phẩm", "Shop")                                                                                                                 | Không trang nào mang từ khóa "sơn mài Việt Nam", "Vietnamese lacquerware"… ở title/H1.                                                      |
| 18 file font preload (~605 KB, 54% dung lượng trang) tải trước ảnh hero; ảnh LCP không có `fetchpriority`                                                                                        | LCP mobile 6,3 s (ngưỡng 2,5 s) → điểm trải nghiệm trang kém trên mọi ngôn ngữ.                                                             |
| ~330 URL cũ của reddoor.vn (Joomla 2007–2012, WooCommerce `/shop/?product=`) đều 404                                                                                                             | Mất toàn bộ backlink và lịch sử 19 năm của tên miền.                                                                                        |

## 2. Quyết định: tên miền chính là `https://reddoor.vn`

Lý do: trùng tên thương hiệu người dùng gõ ("red door", "reddoor"), trùng domain email `sales@reddoor.vn`, 2.095 bản lưu Wayback từ 2007 và các trang danh bạ (FOB, Yellow Pages, Panjiva) đều dẫn về đây. Từ khóa trong tên miền (`lacquerwares.vn`) không còn tác dụng xếp hạng từ 2012. Code không hard-code host: host chính được suy ra từ `NEXT_PUBLIC_SITE_URL`; nếu sau này đổi ý, chỉ cần đổi biến đó (và các bước Vercel/Search Console tương ứng).

## 3. Những gì code đã làm (working tree, cần commit + push để lên Vercel)

**Chặn lỗi lặp lại**

- `src/lib/seo/site-url-guard.ts` + `next.config.ts`: `next build` **từ chối chạy** ở production nếu site URL là localhost, `http://` hoặc `*.vercel.app` (thông báo lỗi ghi rõ cách sửa). Local build cần `ALLOW_LOOPBACK_SITE_URL=1` (đã có trong `.env`, `.env.example`, CI và Playwright). Thứ tự ưu tiên: `NEXT_PUBLIC_SITE_URL` → domain production của Vercel (`VERCEL_PROJECT_PRODUCTION_URL`, có cảnh báo) → localhost (chỉ dev/test).

**Gộp tên miền và URL cũ** (`next.config.ts` → `redirects()`, 308)

- `www.reddoor.vn`, `lacquerwares.vn`, `www.lacquerwares.vn` → `https://reddoor.vn/...` (giữ nguyên path); alias `reddoor-lacquerwares.vercel.app` → reddoor.vn (trừ `/api` vì Vercel Cron gọi vào alias).
- `/index.html` → `/vi`, `/about.html` → `/vi/about`, `/services.html` → `/vi/process`, `/contact.html` → `/vi/contact`; `/shop/*` (WooCommerce) → `/vi/shop`; `/index.php`, `/index2.php`, `/home/*` (Joomla) → `/vi`; `/about|contact|products|news|collections|process|privacy|terms|accessibility/*` không có tiền tố ngôn ngữ → `/vi/...`.
- Trang gốc `/` → `/vi` bằng 308 (`src/app/(root)/page.tsx`).

**Index đúng trang**

- Xóa `src/app/[locale]/loading.tsx`: slug sai trả 404 thật, redirect chéo ngôn ngữ trả 308 thật (đánh đổi: điều hướng client không còn skeleton).
- Canonical/hreflang chỉ cho bản dịch thật; bản fallback canonical về bản gốc và không vào sitemap. Sitemap có `lastmod`, ảnh (kể cả 3 ảnh trang chủ).
- Listing có bộ lọc (`/products?…`, `/news?…`): bỏ chặn trong robots.txt, thay bằng `noindex, follow` và không canonical/hreflang (một cơ chế duy nhất, đúng khuyến nghị Google). `/search` vẫn chặn.
- Trang landing `/[locale]/collections/[slug]` (mới): tiêu đề, mô tả, ảnh bìa, đoạn giới thiệu, link tới catalogue và tới từng sản phẩm. Canonical của flipbook `/catalogue` trỏ về landing; sitemap liệt kê landing.

**Nội dung và từ khóa (6 ngôn ngữ)**

- H1 trang chủ nêu thẳng sản phẩm: "Đồ sơn mài thủ công Việt Nam, sống động qua từng lớp sơn" (en: "Handmade Vietnamese lacquerware, …", tương tự fr/de/ja/zh-CN).
- Tiêu đề + H1 7 trang mục dùng key mới `pages.*Heading` (ví dụ "Sản phẩm sơn mài: khay, hộp, bát, bình | Red Door"); mô tả meta riêng `meta.pageDescriptions.*` ≤160 ký tự cho 11 trang tĩnh. `pages.*Title` giữ làm nhãn ngắn.
- Tiếng Nhật: title dẫn bằng "ベトナム漆器"; tiếng Trung thống nhất "下泰" (trước lẫn 河泰/下泰); sửa lỗi dịch máy tiếng Pháp; trang pháp lý nêu đúng `reddoor.vn` (trước ghi `lacquerware.vn`, domain không tồn tại).
- Eyebrow trên đầu trang và dòng mô tả dưới logo ở header/footer ("Nghệ thuật sơn mài Việt Nam") từng hiện tiếng Việt trên mọi ngôn ngữ → nay theo locale (`src/domains/content/brand-copy.ts`; tiếng Việt giữ nguyên). Alt ảnh trang chủ và ảnh shop theo đúng ngôn ngữ trang.
- Footer có link `<a hreflang>` tới trang chủ của cả 6 ngôn ngữ; breadcrumb hiển thị trên trang chi tiết (trùng nhãn với BreadcrumbList JSON-LD).

**Structured data**

- Organization + WebSite (trang chủ, có alias "REDDOOR VIETNAM", "RED DOOR Co., Ltd", "reddoor.vn"…), Article (tin, có `author.url`, nhiều ảnh 16:9/4:3/1:1), Product + Offer (shop), BreadcrumbList trên mọi trang mục và chi tiết. Ngày đăng bài theo múi giờ +07:00.

**Tốc độ**

- Font: Playfair static 400 (thường + nghiêng), bỏ trục `opsz`, chỉ preload subset latin + vietnamese → 18 file/614 KB xuống 12 file/154 KB. Ảnh hero `preload` + `fetchpriority="high"`; ảnh đầu trang chi tiết/PageHero không còn lazy.

**Kênh khác**

- IndexNow (Bing/Yandex/Naver): key `37bf5f5ad05844f99d4fab467b506df7` tại `public/<key>.txt`; đăng/ẩn bài, sản phẩm, bộ sưu tập, shop tự gửi URL qua `after()`; lệnh một lần `npm run seo:indexnow -- --site-url https://reddoor.vn` gửi cả sitemap.

## 4. Biến môi trường liên quan

| Biến                                   | Ở đâu                            | Giá trị                                                                                             |
| -------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | Vercel Production **và** Preview | `https://reddoor.vn` (bắt buộc; đổi xong phải **Redeploy** vì `NEXT_PUBLIC_*` được nhúng lúc build) |
| `ALLOW_LOOPBACK_SITE_URL`              | chỉ `.env` local, CI, Playwright | `1` — **không bao giờ** đặt trên Vercel                                                             |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Vercel Production                | token thẻ HTML từ Search Console (tùy chọn nếu xác minh qua DNS)                                    |
| `NEXT_PUBLIC_BING_SITE_VERIFICATION`   | Vercel Production                | token Bing Webmaster (tùy chọn)                                                                     |
| `SEO_GOOGLE_MAPS_PLACE_URL`            | Vercel Production                | link `/maps/place/…` hoặc `?cid=` của Business Profile sau khi đã claim và địa chỉ khớp site        |
| `INDEXNOW_KEY`                         | không cần                        | chỉ đặt nếu muốn đổi key; khi đó thay cả `public/<key>.txt`                                         |

## 5. Checklist chủ site (theo thứ tự)

1. **Vercel → Settings → Environment Variables**: thêm `NEXT_PUBLIC_SITE_URL=https://reddoor.vn` cho Production và Preview. Bật "Automatically expose System Environment Variables" (lưới an toàn thứ hai).
2. **Commit + push** working tree lên `main` (Vercel tự build). Nếu build báo `SiteUrlConfigurationError` là do bước 1 chưa xong.
3. **Vercel → Settings → Domains**: `lacquerwares.vn` và `www.lacquerwares.vn` đổi thành "Redirect to reddoor.vn", mã **308**. `www.reddoor.vn`: đang lỗi chứng chỉ TLS (cert chỉ có `reddoor.vn`) — mở dòng domain, bấm Refresh; nếu không hết trong ~10 phút thì Remove rồi Add lại; sau đó đặt Redirect to reddoor.vn, 308.
4. **Kiểm tra sau deploy** (mục 6).
   Ngoài ra vào **Vercel → Project → Firewall**: hiện `https://reddoor.vn/home/index.php` bị chặn `403 X-Vercel-Mitigated: deny` trước khi Next chạy, nên redirect cho ~100 URL Joomla `/home/*` chưa có tác dụng. Tìm rule khớp `/home/*` (custom rule hoặc managed ruleset) và đổi sang Bypass/Log cho đường dẫn đó; kiểm tra thêm rằng không có challenge/deny nào áp lên `/index.php`, `/*.html`, `/shop/*`.
5. **Google Search Console**: thêm Domain property `reddoor.vn` (xác minh bằng bản ghi DNS TXT). Thêm URL-prefix property `https://lacquerwares.vn` và `https://www.lacquerwares.vn` **trước khi** bật redirect ở bước 3 nếu muốn dùng Change of Address (host đã redirect không xác minh bằng thẻ meta được; DNS TXT vẫn được). Gửi sitemap `https://reddoor.vn/sitemap.xml`. Với property lacquerwares: Settings → Change of Address → reddoor.vn. Dùng URL Inspection → Request indexing cho `/vi`, `/en`, `/vi/products`, `/vi/about`.
6. **Bing Webmaster Tools**: thêm site, "Import from Google Search Console", gửi sitemap. Chạy một lần `npm run seo:indexnow -- --site-url https://reddoor.vn` từ máy dev sau khi deploy xong.
7. **Google Business Profile**: hồ sơ "RED DOOR Co., Ltd" đã tồn tại đúng địa chỉ Hạ Thái và số +84 903 498 889 nhưng **chưa được claim**, sai danh mục ("Trung tâm mua sắm") và không có website. Mở `https://maps.google.com/?cid=1300876075056410803` → "Xác nhận doanh nghiệp này" → website `https://reddoor.vn/vi`, danh mục chính "Cửa hàng đồ thủ công mỹ nghệ" / phụ "Nhà sản xuất", "Nhà xuất khẩu"; mô tả dùng đúng câu mô tả trang chủ; thêm ảnh sản phẩm. Không tạo hồ sơ thứ hai. Sau đó điền `SEO_GOOGLE_MAPS_PLACE_URL`.
8. **Danh bạ**: cập nhật Yellow Pages (listing 1304574 đang ghi website `reddoorvietnam.com` đã chết, địa chỉ Long Biên cũ) sang `https://reddoor.vn` + địa chỉ/điện thoại đúng như trang Liên hệ. Tuyệt đối không dùng `facebook.com/reddoor.vn` (là shop hàng Nhật của người khác).
9. **Mạng xã hội trong CMS**: chỉ nhập profile công ty thực sự sở hữu (YouTube `@REDDOOR-VN` đã có; Facebook/LinkedIn nếu lập thì cùng tên, logo, địa chỉ, link về reddoor.vn). Mọi link nhập vào sẽ thành `sameAs` của Organization → sai là Google hiểu nhầm danh tính.
10. **Nội dung CMS** (quan trọng cho từ khóa):
    - Đổi tên 2 bộ sưu tập thành "Bộ sưu tập sơn mài 2026 / 2025" (giữ slug), thay tóm tắt "Catalogue hiện hành của xưởng, đăng từ cổng quản trị" bằng 2–4 câu mô tả thật (loại sản phẩm, chất liệu, Hạ Thái, báo giá). Thêm bản dịch tiếng Anh "Lacquerware Collection 2026" (slug `lacquerware-collection-2026`).
    - fr/de/ja/zh-CN hiện **không có** bản dịch sản phẩm/tin/bộ sưu tập nào (chỉ vi, en) → các trang đó canonical về tiếng Việt. Muốn lên Google Nhật/Trung/Pháp/Đức thì cần dịch tiêu đề + slug + mô tả ngắn (dịch người, không máy). Admin hiện chỉ có tab vi/en; cần mở rộng editor sang 6 ngôn ngữ (việc riêng, chưa làm).
    - Đăng tin đều (1–2 bài/tháng) về sản phẩm, quy trình, hội chợ; mỗi bài có ảnh thật.
11. **Backlink**: xin các báo/đài từng đưa tin (VTV, kênh Pháp) và đối tác B2B đặt link về `https://reddoor.vn`; đăng ký HKTDC/Freshdi với website.

## 6. Kiểm tra sau deploy

```bash
curl -sI https://reddoor.vn/ | head -3                                  # 308, Location: /vi
curl -sI https://www.lacquerwares.vn/vi/about | head -3                  # 308 → https://reddoor.vn/vi/about
curl -sI https://reddoor-lacquerwares.vercel.app/vi | head -3            # 308 → https://reddoor.vn/vi
curl -s https://reddoor.vn/robots.txt | tail -1                          # Sitemap: https://reddoor.vn/sitemap.xml
curl -s https://reddoor.vn/sitemap.xml | grep -o '<loc>[^<]*' | head -3  # https://reddoor.vn/...
curl -s https://reddoor.vn/vi | grep -o '<link rel="canonical"[^>]*>'   # https://reddoor.vn/vi
curl -s https://reddoor.vn/vi | grep -c application/ld+json              # >= 2
curl -s -o /dev/null -w '%{http_code}\n' https://reddoor.vn/vi/products/khong-ton-tai   # 404
curl -s -o /dev/null -w '%{http_code}\n' https://reddoor.vn/contact.html                # 308
curl -sI https://reddoor.vn/manifest.webmanifest | head -1               # 200
```

Sau đó: Rich Results Test (`search.google.com/test/rich-results`) cho trang chủ, một bài tin, một sản phẩm shop; PageSpeed Insights mobile cho `/vi` (kỳ vọng LCP giảm 1–2 s so với 6,3 s; door intro vẫn là yếu tố còn lại).

## 7. Kỳ vọng thời gian

- Index lại: vài ngày đến 2–3 tuần sau khi Search Console nhận sitemap và canonical đúng.
- Từ khóa thương hiệu ("red door sơn mài", "reddoor vietnam"): thường lên trang nhất trong vòng 1 tháng sau khi gộp domain + Business Profile.
- Từ khóa chung ("sơn mài Việt Nam", "Vietnamese lacquerware"): cạnh tranh với Wikipedia, báo, Hạ Thái Bamboo Lacquer… — cần nội dung đều đặn và backlink; on-page hiện đã đủ điều kiện, phần còn lại là thời gian và nội dung.
