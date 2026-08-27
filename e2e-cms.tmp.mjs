import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const run = Date.now().toString(36).slice(-4);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 1100 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 160)));

// Make two small photographs to upload.
const art = await ctx.newPage();
await art.setContent(`<div style="width:1200px;height:800px;background:linear-gradient(120deg,#8a171b,#c2a052)"></div>`);
writeFileSync("test-cover.png", await art.locator("div").screenshot());
await art.setContent(`<div style="width:1000px;height:1250px;background:radial-gradient(circle,#3d0d10,#c2a052)"></div>`);
writeFileSync("test-product.png", await art.locator("div").screenshot());
await art.close();

// Sign in as director.
await p.goto("http://localhost:3000/vi/admin/sign-in", { waitUntil: "domcontentloaded" });
await p.waitForSelector("text=Vào thẳng theo vai trò");
await p.click('button:has(span:text-is("admin"))');
await p.waitForSelector("text=Quyền truy cập của phiên này", { timeout: 30000 });
console.log("signed in");

/* ---------------- Article ---------------- */
await p.goto("http://localhost:3000/vi/admin/news/new", { waitUntil: "domcontentloaded" });
await p.waitForSelector("text=Thông tin chung", { timeout: 30000 });
await p.selectOption("select", "xuong");
await p.fill('input[maxlength="200"]', "Red Door Vietnam");
// tags input (maxlength 1000)
await p.fill('input[maxlength="1000"]', "sơn mài, thủ công");
await p.fill('input[maxlength="300"]', "Một ngày trong xưởng " + run + "");
await p.fill('textarea[maxlength="1000"]', "Ghi chép thật từ xưởng, đăng qua trình quản trị mới.");
await p.fill("textarea:not([maxlength])", "Đoạn mở đầu của bài viết thật.\n\nĐoạn thứ hai kể về công đoạn mài nước.");
await p.click('button:has-text("Lưu bản nháp")');
await p.waitForURL(//admin/news/[a-f0-9]{24}/, { timeout: 30000 });
console.log("article draft saved:", p.url());
await p.goto(p.url(), { waitUntil: "domcontentloaded" });
await p.waitForSelector("text=Thông tin chung", { timeout: 30000 });

// Cover upload.
const coverInput = p.locator('input[type="file"]');
await coverInput.setInputFiles("test-cover.png");
await p.waitForSelector('button:has-text("Thay ảnh")', { timeout: 60000 });
console.log("cover uploaded");

await p.click('button:has-text("Xuất bản")');
await p.waitForSelector("text=Đã xuất bản.", { timeout: 60000 });
console.log("article published");
await p.screenshot({ path: "shot-news-editor.png", fullPage: true });

/* ---------------- Product ---------------- */
await p.goto("http://localhost:3000/vi/admin/products/new", { waitUntil: "domcontentloaded" });
await p.waitForSelector("text=Định danh", { timeout: 30000 });
await p.fill('input[maxlength="80"]', "KHAY-T" + run.toUpperCase() + "");
// check first collection box if present
const firstBox = p.locator('input[type="checkbox"]').first();
if (await firstBox.count()) await firstBox.check().catch(() => {});
// spec inputs by label order: materials, finishes, colors, leadTime
const specInputs = p.locator("section:has(h2:text-is('Thông số')) input");
await specInputs.nth(0).fill("Tre ép, Sơn ta");
await specInputs.nth(1).fill("Bóng mờ");
await specInputs.nth(2).fill("Đỏ trầm");
await specInputs.nth(3).fill("30");
await specInputs.nth(4).fill("40");
await specInputs.nth(5).fill("25");
await specInputs.nth(6).fill("5");
// translation
await p.fill('section:has(h2:text-is("Bản dịch")) input[maxlength="300"]', "Khay CMS " + run + "");
await p.fill('section:has(h2:text-is("Bản dịch")) textarea[maxlength="500"]', "Sản phẩm thật đầu tiên đăng qua trình quản trị.");
const bigAreas = p.locator('section:has(h2:text-is("Bản dịch")) textarea:not([maxlength])');
await bigAreas.nth(0).fill("Mô tả chi tiết sản phẩm.\n\nHoàn thiện bóng thủ công nhiều lớp.");
await bigAreas.nth(1).fill("Lau bằng khăn mềm ẩm\nTránh ánh nắng trực tiếp");
await p.click('button:has-text("Lưu bản nháp")');
await p.waitForURL(//admin/products/[a-f0-9]{24}/, { timeout: 30000 });
console.log("product draft saved:", p.url());
await p.goto(p.url(), { waitUntil: "domcontentloaded" });
await p.waitForSelector("text=Định danh", { timeout: 30000 });

// Two gallery images.
const galleryInput = p.locator('input[type="file"]');
await galleryInput.setInputFiles("test-product.png");
await p.waitForSelector('img[src*="products"]', { timeout: 60000 });
await galleryInput.setInputFiles("test-cover.png");
await p.waitForSelector('button:has-text("Gỡ") >> nth=1', { timeout: 60000 });
console.log("two images uploaded");

await p.click('button:has-text("Xuất bản")');
await p.waitForSelector("text=Đã xuất bản.", { timeout: 60000 });
console.log("product published");
await p.screenshot({ path: "shot-product-editor.png", fullPage: true });

/* ---------------- Public verification ---------------- */
await p.goto("http://localhost:3000/vi/news", { waitUntil: "domcontentloaded" });
await p.waitForSelector("text=Một ngày trong xưởng " + run + "", { timeout: 30000 });
const newsHtml = await p.content();
console.log("news list: category label =", newsHtml.includes("Từ xưởng"), "| cover img =", newsHtml.includes("res.cloudinary.com"));
await p.click("text=Một ngày trong xưởng " + run + "");
await p.waitForSelector("text=Đoạn thứ hai kể về công đoạn mài nước", { timeout: 30000 });
console.log("news detail renders body");
await p.screenshot({ path: "shot-public-news.png", fullPage: true });

await p.goto("http://localhost:3000/vi/products", { waitUntil: "domcontentloaded" });
await p.waitForSelector("text=Khay CMS " + run + "", { timeout: 30000 });
const prodHtml = await p.content();
console.log("product list: real image =", prodHtml.includes("res.cloudinary.com"));
await p.click("text=Khay CMS " + run + "");
await p.waitForSelector("text=Hoàn thiện bóng thủ công nhiều lớp", { timeout: 30000 });
const detailText = await p.evaluate(() => document.body.innerText);
console.log("detail: care =", detailText.includes("Lau bằng khăn mềm ẩm"), "| materials =", detailText.includes("Tre ép"));
await p.screenshot({ path: "shot-public-product.png", fullPage: true });

await b.close();
console.log("E2E complete");
