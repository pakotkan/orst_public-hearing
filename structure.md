# โครงสร้างโปรเจกต์: ประชาพิจารณ์ สมุดปกขาว (ORST Public Hearing)

เอกสารนี้อธิบายว่าแต่ละโฟลเดอร์และไฟล์ในโปรเจกต์ทำหน้าที่อะไร ส่วนวิธีติดตั้ง การ deploy รายการ API ทั้งหมด และตารางสิทธิ์ ดูได้ที่ [README.md](README.md)

## โปรเจกต์นี้คืออะไร

ระบบรับฟังความคิดเห็นสาธารณะ:

- **ผู้ดูแลระบบ** เขียนเรื่อง ดูและลบความคิดเห็น และจัดการบัญชีผู้ใช้
- **ผู้เยี่ยมชม** อ่านเรื่องที่เผยแพร่ได้
- **ผู้ใช้** แสดงความคิดเห็นได้ และเห็นหรือลบได้เฉพาะความคิดเห็นของตนเอง

ระบบมี 3 ส่วนที่รันใน Docker:

```
Browser ──► Nginx (port 80) ──┬── /            → React app ที่ build แล้ว (ไฟล์ static)
                              ├── /api/*       → Backend API (Bun + Elysia, port 3001) ──► PostgreSQL
                              └── /uploads/*   → ไฟล์ที่อัปโหลด (Docker volume ที่ใช้ร่วมกัน)
```

ทุกอย่างให้บริการจาก origin เดียวกัน คุกกี้เข้าสู่ระบบจึงใช้งานได้โดยไม่ต้องตั้งค่า CORS

## ระดับบนสุด

```
orst_public-hearing/
├── backend/                 API server (Bun + ElysiaJS + Prisma)
├── frontend/                เว็บแอป (React + Vite + TipTap)
├── nginx/                   Reverse proxy ที่ build และให้บริการ frontend ด้วย
├── docker-compose.yml       ชุด production: db + api + nginx
├── docker-compose.dev.yml   ส่วนเสริมโหมด dev: live reload, ไม่ใช้ Nginx
├── .env / .env.example      ค่าตั้งของ docker compose (รหัสผ่าน, secret, บัญชีผู้ดูแล)
├── .dockerignore            กัน node_modules, dist, uploads และ .env ออกจาก Docker image
├── .gitignore               กัน node_modules, ไฟล์ build, uploads และ .env ออกจาก git
├── README.md                วิธีติดตั้ง, deploy, API และเส้นทาง
└── structure.md             ไฟล์นี้
```

| ไฟล์ | หน้าที่ |
| --- | --- |
| [docker-compose.yml](docker-compose.yml) | กำหนดชื่อโปรเจกต์เป็น `orst_e-feedback` (เพื่อให้ container และ volume ไม่เปลี่ยนเมื่อเปลี่ยนชื่อโฟลเดอร์) และมี 3 service: `db` (PostgreSQL 16 พร้อม health check), `api` (build จาก `backend/`) และ `nginx` (build จาก `nginx/Dockerfile` เปิดที่ `HTTP_PORT`) มี volume 2 ตัว: `pgdata` สำหรับฐานข้อมูล และ `uploads` สำหรับไฟล์แนบ ซึ่ง `api` อ่าน/เขียนได้ และ `nginx` อ่านได้อย่างเดียว |
| [docker-compose.dev.yml](docker-compose.dev.yml) | ใช้ซ้อนบนไฟล์ production โดย mount source ของ `backend/` และ `frontend/` เข้า container รัน API ด้วย nodemon และรัน frontend ด้วย Vite dev server ที่พอร์ต 5173 ปิด Nginx และเปิดพอร์ตฐานข้อมูล 5432 ให้โปรแกรมอย่าง DBeaver เชื่อมต่อได้ การตรวจจับไฟล์ใช้วิธี polling เพราะ event ของไฟล์บน Windows ส่งไปไม่ถึง container Linux |
| [.env.example](.env.example) | แม่แบบของ `.env`: `HTTP_PORT`, `POSTGRES_*`, `JWT_SECRET`, `COOKIE_SECURE` และ `ADMIN_*` (บัญชีผู้ดูแลที่สร้างตอน API เริ่มทำงาน) |

## `backend/`: API

สร้างด้วย **Bun** (runtime), **ElysiaJS** (web framework), **Prisma** (เข้าถึงฐานข้อมูล) และ **sanitize-html**

```
backend/
├── Dockerfile               Bun image: ติดตั้ง dependency, generate Prisma client, รัน migration, เริ่ม server
├── package.json             Scripts (dev, dev:docker, start, typecheck, prisma:*) และ dependency
├── bun.lock                 เวอร์ชัน dependency ที่ล็อกไว้
├── tsconfig.json            TypeScript แบบ strict ใช้ตรวจ type อย่างเดียว (Bun รัน .ts ได้โดยตรง)
├── .env.example             ค่าตั้งสำหรับรัน API นอก Docker
├── prisma/
│   ├── schema.prisma        โมเดลฐานข้อมูล
│   └── migrations/          SQL migration ที่รันด้วย `prisma migrate deploy` ตอนเริ่มระบบ
└── src/
    ├── index.ts             จุดเริ่มต้น
    ├── lib/                 ตัวช่วยที่ใช้ร่วมกัน
    └── routes/              HTTP endpoint แยกตามส่วน
```

### `backend/prisma/`

[schema.prisma](backend/prisma/schema.prisma) กำหนด 4 ตาราง:

| โมเดล | ใช้เก็บ | หมายเหตุ |
| --- | --- | --- |
| `User` | บัญชีผู้ใช้ | `role` เป็น `USER` หรือ `ADMIN`; `isBanned` ใช้ระงับการเข้าสู่ระบบ; อีเมลห้ามซ้ำ |
| `Post` | เรื่องรับฟังความคิดเห็น | `content` เป็น HTML ที่กรองแล้ว; `isPublished` กำหนดว่าแสดงต่อสาธารณะหรือไม่; ถ้าผู้เขียนถูกลบ ผู้เขียนจะกลายเป็นค่าว่าง |
| `Attachment` | ไฟล์แนบของเรื่อง | `storedName` คือชื่อไฟล์สุ่มบนดิสก์; ถูกลบไปพร้อมเรื่อง |
| `Comment` | ความคิดเห็น | เห็นได้เฉพาะเจ้าของและผู้ดูแล; ถูกลบไปพร้อมเรื่องหรือผู้ใช้ |

Migration ที่มีอยู่:
- `20261002000000_init` สร้างตารางทั้งหมด
- `20261006000000_remove_comment_hidden` ลบคอลัมน์ `isHidden` ของความคิดเห็น (เลิกใช้ฟีเจอร์ซ่อนความคิดเห็น)

เพิ่ม migration ใหม่ด้วย `bunx prisma migrate dev --name <change>`

### `backend/src/index.ts`

เริ่มการทำงานของ server:

1. Mount route ทั้งหมดไว้ใต้ `/api` (`/api/health`, auth, posts, admin)
2. ลงทะเบียนตัวจัดการ error กลาง ที่แปลง error เป็น JSON `{ error: "..." }` พร้อม status ที่ถูกต้อง (`HttpError` → status ของมันเอง, ข้อมูลไม่ผ่านการตรวจ → 422, ไม่พบ route → 404, body ผิดรูปแบบ → 400, อื่น ๆ → 500)
3. ให้บริการ `/uploads/*` จากดิสก์ (ใน production Nginx ทำหน้าที่นี้ route นี้มีไว้สำหรับการพัฒนา)
4. เรียก `ensureAdmin()` แล้วรอรับคำขอที่พอร์ต 3001

### `backend/src/lib/`: ตัวช่วยที่ใช้ร่วมกัน

| ไฟล์ | หน้าที่ |
| --- | --- |
| [env.ts](backend/src/lib/env.ts) | อ่านค่า environment variable ไว้ที่เดียว `JWT_SECRET` ต้องมี ส่วนค่าอื่นมีค่าเริ่มต้น |
| [db.ts](backend/src/lib/db.ts) | `PrismaClient` ที่ใช้ร่วมกัน และ `select` ที่ใช้ซ้ำ: `publicUserSelect` (ข้อมูลที่ผู้ใช้เห็นเกี่ยวกับตัวเอง) และ `authorSelect` (มีแค่ id และชื่อ ใช้แสดงผู้เขียนต่อผู้อื่น) |
| [auth.ts](backend/src/lib/auth.ts) | `authPlugin` อ่าน JWT จากคุกกี้ `token` แล้วเพิ่ม `user` (หรือ `null`) ให้ทุกคำขอ ผู้ใช้ที่ถูกระงับนับเป็นยังไม่เข้าสู่ระบบ `requireUser()` ส่ง 401 และ `requireAdmin()` ส่ง 403 Session มีอายุ 7 วัน |
| [errors.ts](backend/src/lib/errors.ts) | `HttpError(status, message)` ที่ route ใช้ throw และ `index.ts` แปลงเป็น JSON |
| [html.ts](backend/src/lib/html.ts) | `sanitizeRichText()` กรอง HTML ของเรื่องให้เหลือเฉพาะแท็กที่อนุญาต (ย่อหน้า หัวข้อ รายการ ลิงก์ ข้อความอ้างอิง โค้ด ฯลฯ) และบังคับให้ลิงก์เปิดในแท็บใหม่อย่างปลอดภัย `excerpt()` สร้างข้อความย่อสำหรับการ์ดเรื่อง |
| [uploads.ts](backend/src/lib/uploads.ts) | บันทึกไฟล์แนบไว้ที่ `UPLOAD_DIR/posts/<uuid>.<ext>` รับเฉพาะนามสกุลที่กำหนด (รูปภาพ PDF Office TXT CSV ZIP; ไม่รับ HTML และ SVG) ขนาดไม่เกิน 10 MB นอกจากนี้ยังลบไฟล์ สร้าง URL `/uploads/...` และป้องกัน path traversal |
| [seed.ts](backend/src/lib/seed.ts) | `ensureAdmin()` สร้างผู้ดูแลจาก `ADMIN_EMAIL` / `ADMIN_PASSWORD` ตอนเริ่มระบบ หรือถ้ามีบัญชีนั้นอยู่แล้วจะตั้งเป็นผู้ดูแลและยกเลิกการระงับ |

### `backend/src/routes/`: endpoint

| ไฟล์ | Prefix | ใครใช้ได้ | ทำอะไร |
| --- | --- | --- | --- |
| [auth.ts](backend/src/routes/auth.ts) | `/api/auth` | ทุกคน | สมัครสมาชิก เข้าสู่ระบบ ออกจากระบบ และ `me` ตั้งและล้างคุกกี้ session แบบ httpOnly และ export ตัวตรวจข้อมูลที่ใช้ร่วมกัน (`nameField`, `emailField`, `passwordField`) |
| [posts.ts](backend/src/routes/posts.ts) | `/api` | ทุกคน (แสดงความคิดเห็นต้องเข้าสู่ระบบ) | รายการเรื่องที่เผยแพร่พร้อมข้อความย่อและภาพปก อ่านเรื่องพร้อมไฟล์แนบ รายการความคิดเห็น (หน้าละ 20) เพิ่มความคิดเห็น และลบความคิดเห็น (เจ้าของหรือผู้ดูแล) `visibleComments()` กำหนดว่าใครเห็นความคิดเห็นใด: ผู้ดูแลเห็นทั้งหมด ผู้ใช้เห็นของตนเอง ผู้เยี่ยมชมไม่เห็นเลย |
| [admin.ts](backend/src/routes/admin.ts) | `/api/admin` | ผู้ดูแลเท่านั้น (ตรวจก่อนทุก handler) | สร้าง แก้ไข และลบเรื่อง (การลบจะลบไฟล์บนดิสก์ด้วย) อัปโหลดและลบไฟล์แนบ รายการความคิดเห็นของแต่ละเรื่อง (ค้นหาด้วยชื่อผู้แสดงความคิดเห็นและช่วงวันที่) และลบความคิดเห็น รายการผู้ใช้พร้อมค้นหาและแบ่งหน้า (หน้าละ 25) สร้าง แก้ไข ระงับ และลบผู้ใช้ ผู้ดูแลไม่สามารถลดสิทธิ์ ระงับ หรือลบตนเองได้ |

## `frontend/`: เว็บแอป

สร้างด้วย **React 19**, **React Router 7**, **Vite** และ **TipTap** (ตัวแก้ไข rich text) เป็นแอปเดียวสำหรับทั้งหน้าสาธารณะและหน้าผู้ดูแล

```
frontend/
├── index.html               HTML หลักที่โหลด src/main.tsx
├── package.json             Scripts (dev, build, preview) และ dependency
├── package-lock.json        เวอร์ชัน dependency ที่ล็อกไว้
├── tsconfig.json            ค่าตั้ง TypeScript แบบ strict
├── vite.config.ts           Dev server ที่ :5173, proxy /api และ /uploads ไปที่ API
├── public/
│   └── robots.txt           บอก search engine ให้ข้าม /admin/ และ /api/
└── src/
    ├── main.tsx             Mount <App> ภายใน BrowserRouter และ AuthProvider
    ├── App.tsx              เส้นทางทั้งหมด
    ├── styles.css           สไตล์ทั้งหมด (ไฟล์เดียว, CSS ธรรมดา)
    ├── lib/                 ตัวเรียก API และสถานะการเข้าสู่ระบบ
    ├── components/          Layout และส่วนประกอบที่ใช้ซ้ำ
    └── pages/               หนึ่งไฟล์ต่อหนึ่งหน้าจอ
```

### `frontend/src/App.tsx`

กำหนดเส้นทางทั้งหมด หน้าสาธารณะอยู่ใน `PublicLayout` หน้าผู้ดูแลอยู่ใน `AdminLayout` และ **โหลดเมื่อต้องใช้ (lazy-load)** ผู้เยี่ยมชมจึงไม่ต้องดาวน์โหลดโค้ดของผู้ดูแลหรือตัวแก้ไข `KeyedPostEditor` สร้างตัวแก้ไขใหม่เมื่อสลับเรื่อง เพื่อไม่ให้เนื้อหาเก่าค้างอยู่ `ScrollToTop` เลื่อนหน้าขึ้นบนสุดทุกครั้งที่เปิดหน้าใหม่ (ปุ่มย้อนกลับ/ไปข้างหน้าของเบราว์เซอร์ยังคงตำแหน่งเดิม)

### `frontend/src/lib/`

| ไฟล์ | หน้าที่ |
| --- | --- |
| [api.ts](frontend/src/lib/api.ts) | `api()` ตัวเรียก fetch: เรียก `/api/...` พร้อมคุกกี้ ส่ง JSON และ throw `ApiError` พร้อมข้อความจาก server เก็บ TypeScript type ของทุก response และตัวช่วยเล็ก ๆ (`qs`, `formatDate`, `formatLongDate`, `fullName`, `formatBytes`, `isImage`, `isPdf`, `errorMessage`) |
| [site.ts](frontend/src/lib/site.ts) | ชื่อเว็บไซต์ ("ประชาพิจารณ์ สมุดปกขาว (White Paper)") ที่ใช้ในส่วนหัว ส่วนท้าย และแถบเมนูผู้ดูแล แก้ชื่อได้ที่นี่ |
| [auth.tsx](frontend/src/lib/auth.tsx) | `AuthProvider` / `useAuth()`: โหลดผู้ใช้ปัจจุบันจาก `/api/auth/me` ตอนเริ่ม และมี `setUser` กับ `logout` `loginUrl()` สร้าง `/login?next=...` และ `safeNext()` อนุญาตเฉพาะการ redirect ภายในเว็บเดียวกัน |

### `frontend/src/components/`

| ไฟล์ | หน้าที่ |
| --- | --- |
| [PublicLayout.tsx](frontend/src/components/PublicLayout.tsx) | ส่วนหัวที่มีโลโก้ ลิงก์เข้าสู่ระบบ/สมัครสมาชิก หรือชื่อผู้ใช้ ลิงก์ไปหน้าผู้ดูแล (เฉพาะผู้ดูแล) และปุ่มออกจากระบบ |
| [AdminLayout.tsx](frontend/src/components/AdminLayout.tsx) | ตรวจสิทธิ์ผู้ดูแลและแถบเมนูด้านข้าง ส่งผู้เยี่ยมชมไปหน้าเข้าสู่ระบบ และผู้ที่ไม่ใช่ผู้ดูแลไปที่ `/` |
| [RichTextEditor.tsx](frontend/src/components/RichTextEditor.tsx) | ตัวแก้ไข TipTap พร้อมแถบเครื่องมือ (ตัวหนา ตัวเอียง ขีดเส้นใต้ ขีดฆ่า H2/H3 รายการ ข้อความอ้างอิง ลิงก์ เส้นคั่น เลิกทำ/ทำซ้ำ) ส่งออกเป็น HTML |
| [AttachmentList.tsx](frontend/src/components/AttachmentList.tsx) | แสดงรูปเป็นแกลเลอรีและไฟล์อื่นเป็นรายการดาวน์โหลด มีปุ่ม **ลบ** เมื่อส่ง `onDelete` มา (ใช้ในหน้าแก้ไขเรื่อง) |
| [PdfViewer.tsx](frontend/src/components/PdfViewer.tsx) | แสดงไฟล์ PDF ในหน้าเว็บด้วยตัวแสดง PDF ของเบราว์เซอร์ พร้อมปุ่ม **เปิดในแท็บใหม่** และ **ดาวน์โหลด** (เบราว์เซอร์บนมือถือบางตัวแสดง PDF ในหน้าไม่ได้) |
| [ui.tsx](frontend/src/components/ui.tsx) | ส่วนประกอบเล็ก ๆ ที่ใช้ร่วมกัน: `Pagination`, `ErrorBanner`, `Loading`, `BookIcon`, `Brand` |

### `frontend/src/pages/`

| ไฟล์ | เส้นทาง | หน้าที่ |
| --- | --- | --- |
| [PostList.tsx](frontend/src/pages/PostList.tsx) | `/` | หน้าแรก: แบนเนอร์พร้อมช่องค้นหา และการ์ดเรื่องที่เผยแพร่ (ภาพปก หัวข้อ ข้อความย่อ วันที่เผยแพร่) |
| [PostDetail.tsx](frontend/src/pages/PostDetail.tsx) | `/posts/:id` | การ์ดด้านบนแสดงหัวข้อ วันที่เผยแพร่ และเนื้อหา ด้านล่างซ้ายเป็นตัวแสดง PDF ของไฟล์แนบแต่ละไฟล์ (PdfViewer) ตามด้วยรายการความคิดเห็น (ปุ่ม "ดูเพิ่มเติม") ด้านขวาเป็นกล่องเขียนความคิดเห็นที่อยู่ข้าง PDF และค้างอยู่บนจอขณะเลื่อน (บนจอแคบจะเรียงลงด้านล่าง) ถ้าผู้เยี่ยมชมกดส่งความคิดเห็น ร่างจะถูกเก็บใน `sessionStorage` แล้วพาไปหน้าเข้าสู่ระบบ เมื่อเข้าสู่ระบบแล้วจะกลับมาพร้อมร่างเดิม |
| [AuthPage.tsx](frontend/src/pages/AuthPage.tsx) | `/login`, `/register` | ฟอร์มเดียวใช้ทั้งสองแบบ เมื่อสำเร็จจะไปที่ `?next=` ถ้ามี ไม่เช่นนั้นผู้ดูแลไปที่ `/admin/posts` และผู้ใช้ไปที่ `/` |
| [NotFound.tsx](frontend/src/pages/NotFound.tsx) | เส้นทางที่ไม่รู้จัก | หน้า 404 |
| [admin/Posts.tsx](frontend/src/pages/admin/Posts.tsx) | `/admin/posts` | ตารางเรื่องทั้งหมดรวมฉบับร่าง พร้อมปุ่มแก้ไข ความคิดเห็น และลบ (การลบต้องยืนยัน) หัวข้อที่เผยแพร่แล้วลิงก์ไปหน้าเรื่อง |
| [admin/PostEditor.tsx](frontend/src/pages/admin/PostEditor.tsx) | `/admin/posts/new`, `/admin/posts/:id/edit` | หัวข้อ เนื้อหา rich text ไฟล์แนบ และสวิตช์เผยแพร่ สำหรับเรื่องใหม่ ไฟล์ที่เลือกจะรออัปโหลดหลังบันทึกครั้งแรก |
| [admin/PostComments.tsx](frontend/src/pages/admin/PostComments.tsx) | `/admin/posts/:id/comments` | ความคิดเห็นทั้งหมดของเรื่องในรูปแบบการ์ด (ข้อความด้านบน ชื่อและวันที่ด้านล่าง ไม่แสดงอีเมล) พร้อมปุ่มลบ ค้นหาด้วยชื่อและช่วงวันที่ได้ (ตั้งแต่–ถึง นับรวมทั้งสองวัน) |
| [admin/Users.tsx](frontend/src/pages/admin/Users.tsx) | `/admin/users` | ค้นหา แบ่งหน้า ฟอร์มเพิ่ม/แก้ไข (ชื่อ อีเมล รีเซ็ตรหัสผ่าน สิทธิ์ ระงับ) และปุ่มแก้ไข/ลบ ไม่สามารถเปลี่ยนสิทธิ์ ระงับ หรือลบบัญชีของตนเองได้ |

## `nginx/`: reverse proxy

| ไฟล์ | หน้าที่ |
| --- | --- |
| [Dockerfile](nginx/Dockerfile) | มี 2 ขั้น: build frontend ด้วย Node 22 (`npm run build`) แล้วคัดลอกผลลัพธ์ `dist/` ไปไว้ใน Nginx image ใช้ root ของโปรเจกต์เป็น build context |
| [nginx.conf](nginx/nginx.conf) | Proxy `/api/` ไปที่ `api:3001` จำกัดการเข้าสู่ระบบและสมัครสมาชิก (10 ครั้งต่อนาทีต่อ IP) ให้บริการ `/uploads/` จาก volume ที่ใช้ร่วมกัน cache ไฟล์ `/assets/` ที่มี hash ไว้ 1 ปี ส่งเส้นทางที่ไม่รู้จักไปที่ `index.html` ให้ React Router จัดการ และเพิ่ม security header ขนาดอัปโหลดสูงสุด 11 MB |

## ลำดับการทำงานของคำขอ

**ผู้เยี่ยมชมแสดงความคิดเห็น**

1. `PostDetail.tsx` เห็นว่ายังไม่มีผู้ใช้ จึงบันทึกร่างและพาไปที่ `/login?next=/posts/<id>`
2. `AuthPage.tsx` ส่งคำขอไปที่ `/api/auth/login` `routes/auth.ts` ตรวจรหัสผ่านและตั้งคุกกี้ `token`
3. ผู้ใช้ถูกพากลับมาที่เรื่อง และร่างถูกใส่กลับในกล่องความคิดเห็น
4. กดส่งจะเรียก `/api/posts/<id>/comments` `authPlugin` อ่านคุกกี้ `requireUser()` ผ่าน แล้ว Prisma บันทึกความคิดเห็น

**ผู้ดูแลเผยแพร่เรื่องพร้อมไฟล์**

1. `PostEditor.tsx` ส่งหัวข้อ HTML และ `isPublished` ไปที่ `POST /api/admin/posts`
2. `routes/admin.ts` ตรวจสิทธิ์ผู้ดูแล กรอง HTML ด้วย `sanitizeRichText()` แล้วบันทึก
3. ไฟล์ที่เลือกแต่ละไฟล์ถูกส่งไปที่ `POST /api/admin/posts/<id>/attachments` `saveFile()` ตรวจชนิดและขนาด แล้วเขียนลง volume `uploads`
4. Nginx ให้บริการไฟล์ที่ `/uploads/posts/<uuid>.<ext>` จาก volume เดียวกัน ถ้าเป็น PDF หน้าเรื่องจะแสดงด้วย `PdfViewer`

## จะแก้อะไร ต้องไปที่ไฟล์ไหน

| ต้องการเปลี่ยน | ไฟล์ |
| --- | --- |
| เพิ่มฟิลด์หรือตารางในฐานข้อมูล | `backend/prisma/schema.prisma` แล้วรัน `bunx prisma migrate dev --name <change>` |
| เพิ่ม endpoint สาธารณะ | `backend/src/routes/posts.ts` (หรือไฟล์ใหม่ที่ลงทะเบียนใน `src/index.ts`) |
| เพิ่ม endpoint ของผู้ดูแล | `backend/src/routes/admin.ts` |
| เปลี่ยนว่าใครเห็นความคิดเห็นใด | `visibleComments()` ใน `backend/src/routes/posts.ts` |
| อนุญาตไฟล์แนบชนิดอื่น | `ALLOWED` ใน `backend/src/lib/uploads.ts` และ `ACCEPT` ใน `frontend/src/pages/admin/PostEditor.tsx` |
| อนุญาต HTML เพิ่มในเรื่อง | `RICH_TEXT_OPTIONS` ใน `backend/src/lib/html.ts` (และปุ่มในแถบเครื่องมือของ `RichTextEditor.tsx`) |
| เพิ่มหน้าใหม่ | `frontend/src/pages/` แล้วเพิ่มเส้นทางใน `frontend/src/App.tsx` |
| เพิ่ม type ของ API response | `frontend/src/lib/api.ts` |
| เปลี่ยนชื่อเว็บไซต์ | `frontend/src/lib/site.ts` |
| เปลี่ยนสไตล์ | `frontend/src/styles.css` |
| เปลี่ยน proxy, cache หรือการจำกัดคำขอ | `nginx/nginx.conf` |
