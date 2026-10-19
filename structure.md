# โครงสร้างโปรเจกต์: ประชาพิจารณ์ สมุดปกขาว (ORST Public Hearing)

เอกสารนี้อธิบายว่าแต่ละโฟลเดอร์และไฟล์ทำหน้าที่อะไร ส่วนวิธีติดตั้ง การ deploy รายการ API และตารางสิทธิ์ ดูที่ [README.md](README.md)

## โปรเจกต์นี้คืออะไร

ระบบรับฟังความคิดเห็นสาธารณะ:

- **ผู้ดูแลระบบ** สร้างเรื่องรับฟังความคิดเห็น (รายละเอียด, PDF, หัวข้อเห็นด้วย/ไม่เห็นด้วย) ดูคำตอบและสรุปผล และจัดการบัญชีผู้ใช้
- **ผู้เยี่ยมชม** อ่านเรื่องที่เปิดหรือปิดรับฟังแล้วได้
- **ผู้ใช้** ตอบแบบรับฟังความคิดเห็นได้ 1 ชุดต่อเรื่อง และแก้ไขหรือถอนได้ขณะเรื่องยังเปิดอยู่

ระบบมี 3 ส่วนที่รันใน Docker:

```
Browser ──► Nginx (port 80) ──┬── /            → React app ที่ build แล้ว (ไฟล์ static)
                              ├── /api/*       → Backend API (Bun + Elysia, port 3001) ──► PostgreSQL
                              └── /uploads/*   → ไฟล์ PDF ที่อัปโหลด (Docker volume ที่ใช้ร่วมกัน)
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
├── .gitattributes           บังคับ line ending แบบ LF (โค้ดรันใน container Linux)
├── README.md                ภาพรวม, API, การ deploy และการพัฒนา
└── structure.md             ไฟล์นี้
```

| ไฟล์ | หน้าที่ |
| --- | --- |
| [docker-compose.yml](docker-compose.yml) | ชื่อโปรเจกต์ `orst_e-feedback` (container และ volume ไม่เปลี่ยนเมื่อเปลี่ยนชื่อโฟลเดอร์) มี 3 service: `db` (PostgreSQL 16 พร้อม health check), `api` (build จาก `backend/`) และ `nginx` (build จาก `nginx/Dockerfile` เปิดที่ `HTTP_PORT`) volume `pgdata` เก็บฐานข้อมูล และ `uploads` เก็บไฟล์ PDF โดย `api` อ่าน/เขียน ส่วน `nginx` อ่านอย่างเดียว log ของทุก container จำกัดไว้ที่ 5 × 10 MB |
| [docker-compose.dev.yml](docker-compose.dev.yml) | ใช้ซ้อนบนไฟล์ production: mount source ของ `backend/` และ `frontend/` เข้า container รัน API ด้วย nodemon และ frontend ด้วย Vite dev server ที่พอร์ต 5173 ปิด Nginx และเปิดพอร์ต 5432 (ฐานข้อมูล) กับ 3001 (API) การตรวจจับไฟล์ใช้ polling เพราะ event ของไฟล์บน Windows ส่งไปไม่ถึง container Linux **ใช้บนเครื่องพัฒนาเท่านั้น** |
| [.env.example](.env.example) | แม่แบบของ `.env`: `HTTP_PORT`, `POSTGRES_*`, `JWT_SECRET`, `COOKIE_SECURE` และ `ADMIN_*` |

## `backend/`: API

สร้างด้วย **Bun** (runtime), **ElysiaJS** (web framework), **Prisma** (ฐานข้อมูล) และ **sanitize-html**

```
backend/
├── Dockerfile               Bun image: ติดตั้งเฉพาะ dependency ที่ใช้ตอนรัน, generate Prisma client, รัน migration แล้วเริ่ม server
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

`prisma` (CLI) อยู่ใน `dependencies` ไม่ใช่ `devDependencies` เพราะ container production ต้องใช้รัน migration ตอนเริ่มทำงาน

### `backend/prisma/`

[schema.prisma](backend/prisma/schema.prisma) กำหนด 5 ตาราง:

| โมเดล | ใช้เก็บ | หมายเหตุ |
| --- | --- | --- |
| `User` | บัญชีผู้ใช้ | `role` เป็น `ADMIN` หรือ `USER`; `status` เป็น `ACTIVE` หรือ `INACTIVE` (soft delete); อีเมลห้ามซ้ำ; เบอร์โทรเก็บแบบตัดช่องว่างและขีดออก |
| `Project` | เรื่องรับฟังความคิดเห็น | `description` เป็น HTML ที่กรองแล้ว; `pdfUrl` ชี้ไปที่ `/uploads/posts/<uuid>.pdf`; `status` เป็น `DRAFT`, `OPEN` หรือ `CLOSED` |
| `SummaryTopic` | หัวข้อในเรื่อง | `order` ห้ามซ้ำภายในเรื่องเดียวกัน; ถูกลบไปพร้อมเรื่อง |
| `Response` | คำตอบ 1 ชุดของผู้ใช้ต่อเรื่อง | unique `(projectId, userId)`; `isAnonymous` คือไม่ประสงค์เปิดเผยชื่อ |
| `TopicAnswer` | คำตอบรายหัวข้อ | `agreement` เห็นด้วยหรือไม่; `additionalComment` และ `relatedAgency` มีได้เฉพาะเมื่อเห็นด้วย (บังคับด้วย CHECK constraint) |

Migration ที่มีอยู่ (เรียงตามลำดับที่รัน):

| Migration | เปลี่ยนอะไร |
| --- | --- |
| `20261002000000_init` | สร้างตารางรุ่นแรก (`User`, `Post`, `Attachment`, `Comment`) |
| `20261006000000_remove_comment_hidden` | ลบคอลัมน์ `Comment.isHidden` |
| `20261008000000_hearing_models_user_status` | เพิ่ม `User.phone` และ `User.status` (แทน `isBanned`), สร้าง `Project`, `Question`, `Response`, `Answer` |
| `20261009000000_posts_to_projects` | ย้ายข้อมูล `Post` → `Project` (id เดิม) และ `Comment` → `Response`/`Answer` แล้วลบตารางเก่า |
| `20261012000000_yes_no_topics` | เปลี่ยนคำถามทุกข้อเป็นแบบเห็นด้วย/ไม่เห็นด้วย (ลบคำตอบเดิม และตั้งเรื่องที่เปิดอยู่กลับเป็นฉบับร่าง) |
| `20261014000000_summary_topics` | `Question` → `SummaryTopic`, `Answer` → `TopicAnswer` (+ `relatedAgency`), `Attachment` → `Project.pdfUrl`, `Role` → `UserRole`, `phone` บังคับกรอก |

บนฐานข้อมูลใหม่ migration ทั้งหมดรันต่อกันได้และให้ผลตรงกับ `schema.prisma` เพิ่ม migration ใหม่ด้วย `bunx prisma migrate dev --name <change>`

### `backend/src/index.ts`

เริ่มการทำงานของ server:

1. Mount route ทั้งหมดไว้ใต้ `/api` (`/api/health`, auth, projects, admin)
2. ตัวจัดการ error กลางแปลง error เป็น JSON `{ error: "..." }` ภาษาไทยพร้อม status ที่ถูกต้อง (`HttpError` → status ของมันเอง, ข้อมูลไม่ผ่านการตรวจ → 422 พร้อมชื่อฟิลด์ภาษาไทยจาก `FIELD_LABELS`, ไม่พบ route → 404, body ผิดรูปแบบ → 400, อื่น ๆ → 500)
3. ให้บริการ `/uploads/*` จากดิสก์ (ใน production Nginx ทำหน้าที่นี้ route นี้มีไว้สำหรับการพัฒนา)
4. เรียก `ensureAdmin()` แล้วรอรับคำขอที่พอร์ต 3001

### `backend/src/lib/`: ตัวช่วยที่ใช้ร่วมกัน

| ไฟล์ | หน้าที่ |
| --- | --- |
| [env.ts](backend/src/lib/env.ts) | อ่าน environment variable ไว้ที่เดียว `JWT_SECRET` ต้องมี ค่าอื่นมีค่าเริ่มต้น เมื่อ `NODE_ENV=production` จะไม่ยอมเริ่มถ้า `JWT_SECRET` สั้นกว่า 32 ตัวอักษรหรือยังเป็น `CHANGE_ME` หรือ `ADMIN_PASSWORD` ยังเป็น `CHANGE_ME` |
| [db.ts](backend/src/lib/db.ts) | `PrismaClient` ที่ใช้ร่วมกัน และ `select` ที่ใช้ซ้ำ: `publicUserSelect` (ข้อมูลที่ผู้ใช้เห็นเกี่ยวกับตัวเอง) และ `authorSelect` (id และชื่อเท่านั้น) |
| [auth.ts](backend/src/lib/auth.ts) | `authPlugin` อ่าน JWT จากคุกกี้ `token` แล้วเพิ่ม `user` (หรือ `null`) ให้ทุกคำขอ บัญชีที่ไม่ใช่ `ACTIVE` นับเป็นยังไม่เข้าสู่ระบบ `requireUser()` ส่ง 401 และ `requireAdmin()` ส่ง 403 Session มีอายุ 7 วัน |
| [errors.ts](backend/src/lib/errors.ts) | `HttpError(status, message)` ที่ route ใช้ throw |
| [html.ts](backend/src/lib/html.ts) | `sanitizeRichText()` กรอง HTML ให้เหลือเฉพาะแท็กที่ตัวแก้ไขสร้างได้ และบังคับให้ลิงก์เปิดในแท็บใหม่อย่างปลอดภัย `excerpt()` สร้างข้อความย่อสำหรับการ์ดเรื่อง |
| [projects.ts](backend/src/lib/projects.ts) | ตรรกะของเรื่องและคำตอบ: `PUBLIC_STATUSES` (`OPEN`, `CLOSED`), `syncSummaryTopics()` ทำให้หัวข้อตรงกับที่ผู้ดูแลส่งมา (สร้าง แก้ เรียงลำดับ และลบ), `cleanTopicAnswers()` ตรวจว่าตอบครบทุกหัวข้อและตัดความเห็น/หน่วยงานออกจากคำตอบ “ไม่เห็นด้วย”, `saveResponse()` สร้างหรือแทนที่คำตอบของผู้ใช้ใน transaction เดียว |
| [uploads.ts](backend/src/lib/uploads.ts) | `savePdf()` บันทึก PDF ที่ `UPLOAD_DIR/posts/<uuid>.pdf` (ตรวจนามสกุล ขนาดไม่เกิน 10 MB และ magic bytes `%PDF-`), `deletePdf()` ลบไฟล์ และ `resolveUploadPath()` ป้องกัน path traversal โฟลเดอร์ชื่อ `posts` คงไว้เพื่อให้ไฟล์ที่อัปโหลดก่อนเปลี่ยนชื่อยังใช้ URL เดิมได้ |
| [seed.ts](backend/src/lib/seed.ts) | `ensureAdmin()` สร้างผู้ดูแลจาก `ADMIN_EMAIL` / `ADMIN_PASSWORD` ตอนเริ่มระบบ ถ้ามีบัญชีนั้นแล้วจะตั้งเป็นผู้ดูแลและเปิดใช้งาน (ไม่เปลี่ยนรหัสผ่าน) |

### `backend/src/routes/`: endpoint

| ไฟล์ | Prefix | ใครใช้ได้ | ทำอะไร |
| --- | --- | --- | --- |
| [auth.ts](backend/src/routes/auth.ts) | `/api/auth` | ทุกคน | สมัครสมาชิก เข้าสู่ระบบ ออกจากระบบ และ `me` ตั้งและล้างคุกกี้ session และ export ตัวตรวจข้อมูลที่ใช้ร่วมกัน (`nameField`, `emailField`, `passwordField`, `phoneField`, `normalizePhone`) |
| [projects.ts](backend/src/routes/projects.ts) | `/api/projects` | ทุกคน (คำตอบต้องเข้าสู่ระบบ) | รายการและรายละเอียดเรื่องที่ `OPEN`/`CLOSED` (รายการบอกด้วยว่าผู้ใช้ตอบแล้วหรือยัง) และ GET/PUT/DELETE คำตอบของผู้ใช้เอง PUT และ DELETE ทำได้เฉพาะเรื่องที่เปิดอยู่ |
| [admin.ts](backend/src/routes/admin.ts) | `/api/admin` | ผู้ดูแลเท่านั้น (ตรวจก่อนทุก handler) | สร้าง แก้ไข ลบเรื่องพร้อมหัวข้อ (เปิดรับฟังได้เมื่อมีหัวข้ออย่างน้อย 1 ข้อ) อัปโหลด/ลบ PDF รายการคำตอบ (ค้นหาชื่อและช่วงเวลา หน้าละ 25) สรุปผลรายหัวข้อ ลบคำตอบ และจัดการผู้ใช้ (ค้นหาชื่อ อีเมล เบอร์โทร) ผู้ดูแลไม่สามารถลดสิทธิ์ ปิดการใช้งาน หรือลบตนเองได้ |

## `frontend/`: เว็บแอป

สร้างด้วย **React 19**, **React Router 7**, **Vite 7** และ **TipTap 3** (ตัวแก้ไข rich text) เป็นแอปเดียวสำหรับทั้งหน้าสาธารณะและหน้าผู้ดูแล

```
frontend/
├── index.html               HTML หลัก (ชื่อเว็บ, meta, ฟอนต์ Kanit และ Bai Jamjuree) ที่โหลด src/main.tsx
├── package.json             Scripts (dev, build, preview) และ dependency
├── package-lock.json        เวอร์ชัน dependency ที่ล็อกไว้
├── tsconfig.json            TypeScript แบบ strict (เปิด resolveJsonModule เพื่ออ่านไฟล์ JSON)
├── vite.config.ts           Dev server ที่ :5173, proxy /api และ /uploads ไปที่ API
├── public/
│   ├── favicon.png          โลโก้ (ใช้ทั้ง favicon และรูปบนการ์ดเรื่อง)
│   └── robots.txt           บอก search engine ให้ข้าม /admin/ และ /api/
└── src/
    ├── main.tsx             Mount <App> ภายใน BrowserRouter และ AuthProvider
    ├── App.tsx              เส้นทางทั้งหมด
    ├── styles.css           สไตล์ทั้งหมด (ไฟล์เดียว, CSS ธรรมดา, โทนสีตาม law.go.th)
    ├── data/                ข้อมูลคงที่ (รายชื่อกระทรวง)
    ├── lib/                 ตัวเรียก API, สถานะการเข้าสู่ระบบ, ค่าคงที่
    ├── components/          Layout และส่วนประกอบที่ใช้ซ้ำ
    └── pages/               หนึ่งไฟล์ต่อหนึ่งหน้าจอ
```

### `frontend/src/App.tsx`

กำหนดเส้นทางทั้งหมด หน้าสาธารณะอยู่ใน `PublicLayout` หน้าผู้ดูแลอยู่ใน `AdminLayout` และ **โหลดเมื่อต้องใช้ (lazy-load)** ผู้เยี่ยมชมจึงไม่ต้องดาวน์โหลดโค้ดผู้ดูแลหรือตัวแก้ไข TipTap `KeyedProjectEditor` สร้างตัวแก้ไขใหม่เมื่อสลับเรื่อง `PostRedirect` พาลิงก์ `/posts/:id` รุ่นเก่าไปที่ `/projects/:id` และ `ScrollToTop` เลื่อนขึ้นบนสุดเมื่อเปิดหน้าใหม่ (ปุ่มย้อนกลับ/ไปข้างหน้ายังคงตำแหน่งเดิม)

### `frontend/src/lib/` และ `frontend/src/data/`

| ไฟล์ | หน้าที่ |
| --- | --- |
| [api.ts](frontend/src/lib/api.ts) | `api()` ตัวเรียก fetch: เรียก `/api/...` พร้อมคุกกี้ ส่ง JSON และ throw `ApiError` พร้อมข้อความจาก server เก็บ TypeScript type ของทุก response ค่าคงที่ (`PROJECT_STATUS_LABEL`, `AGREE_LABEL`, `DEFAULT_TOPIC_COUNT`, `MAX_COMMENT_LENGTH`, `MAX_AGENCY_LENGTH`, `PHONE_PATTERN` ซึ่งต้องตรงกับฝั่ง backend) และตัวช่วย (`qs`, `formatDate`, `formatLongDate`, `fullName`, `errorMessage`) |
| [auth.tsx](frontend/src/lib/auth.tsx) | `AuthProvider` / `useAuth()`: โหลดผู้ใช้ปัจจุบันจาก `/api/auth/me` และมี `setUser` กับ `logout` `loginUrl()` สร้าง `/login?next=...` และ `safeNext()` อนุญาตเฉพาะการ redirect ภายในเว็บ |
| [site.ts](frontend/src/lib/site.ts) | ชื่อเว็บไซต์ที่ใช้ในส่วนหัว แบนเนอร์ ส่วนท้าย และแถบเมนูผู้ดูแล (ชื่อในแท็บเบราว์เซอร์อยู่ใน `index.html`) |
| [ministries.ts](frontend/src/lib/ministries.ts) | `MINISTRY_NAMES` รายชื่อกระทรวงภาษาไทยสำหรับช่อง “หน่วยงานที่เกี่ยวข้อง” |
| [data/ministries_th.json](frontend/src/data/ministries_th.json) | รายชื่อกระทรวง (ไทย/อังกฤษ/ตัวย่อ) แก้ไฟล์นี้เพื่อเปลี่ยนตัวเลือก คำตอบเก็บชื่อภาษาไทย |

### `frontend/src/components/`

| ไฟล์ | หน้าที่ |
| --- | --- |
| [PublicLayout.tsx](frontend/src/components/PublicLayout.tsx) | ส่วนหัว (โลโก้, เข้าสู่ระบบ/สมัครสมาชิก หรือชื่อผู้ใช้, ลิงก์ระบบจัดการสำหรับผู้ดูแล, ออกจากระบบ) และส่วนท้าย |
| [AdminLayout.tsx](frontend/src/components/AdminLayout.tsx) | ตรวจสิทธิ์ผู้ดูแลและแถบเมนูด้านข้าง ส่งผู้เยี่ยมชมไปหน้าเข้าสู่ระบบ และผู้ที่ไม่ใช่ผู้ดูแลไปที่ `/` |
| [TopicField.tsx](frontend/src/components/TopicField.tsx) | หัวข้อ 1 ข้อในแบบรับฟัง ตอบเป็นขั้น: (1) เห็นด้วย/ไม่เห็นด้วย (2) ความเห็นเพิ่มเติม (3) หน่วยงานที่เกี่ยวข้อง ขั้น 2–3 แสดงเฉพาะเมื่อเห็นด้วย และมีตัวช่วยแปลงระหว่างสถานะฟอร์มกับคำตอบที่บันทึก (`emptyTopicDraft`, `toTopicDraft`, `draftAgency`) |
| [RichTextEditor.tsx](frontend/src/components/RichTextEditor.tsx) | ตัวแก้ไข TipTap พร้อมแถบเครื่องมือ (ตัวหนา ตัวเอียง ขีดเส้นใต้ ขีดฆ่า H2/H3 รายการ ข้อความอ้างอิง ลิงก์ เส้นคั่น เลิกทำ/ทำซ้ำ) ส่งออกเป็น HTML |
| [PdfViewer.tsx](frontend/src/components/PdfViewer.tsx) | แสดง PDF ในหน้าเว็บด้วยตัวแสดงของเบราว์เซอร์ พร้อมปุ่ม **เปิดในแท็บใหม่** และ **ดาวน์โหลด** (เบราว์เซอร์มือถือบางตัวแสดง PDF ในหน้าไม่ได้) |
| [ui.tsx](frontend/src/components/ui.tsx) | ส่วนประกอบเล็ก ๆ: `Pagination`, `ErrorBanner`, `Loading`, `BookIcon`, `Brand` |

### `frontend/src/pages/`

| ไฟล์ | เส้นทาง | หน้าที่ |
| --- | --- | --- |
| [ProjectList.tsx](frontend/src/pages/ProjectList.tsx) | `/` | หน้าแรก: แบนเนอร์พร้อมช่องค้นหา (กรองในเบราว์เซอร์) และการ์ดเรื่อง (สถานะ, “คุณตอบแล้ว”, ชื่อเรื่อง, ข้อความย่อ, วันที่เผยแพร่) |
| [ProjectDetail.tsx](frontend/src/pages/ProjectDetail.tsx) | `/projects/:id` | รายละเอียดเรื่อง ตัวแสดง PDF และแบบรับฟัง ถ้าผู้เยี่ยมชมกดส่ง ร่างจะถูกเก็บใน `sessionStorage` แล้วพาไปเข้าสู่ระบบ เมื่อกลับมาร่างจะถูกใส่กลับ ผู้ใช้ที่ตอบแล้วแก้ไขหรือถอนคำตอบได้ขณะเรื่องเปิดอยู่ |
| [AuthPage.tsx](frontend/src/pages/AuthPage.tsx) | `/login`, `/register` | ฟอร์มเดียวใช้ทั้งสองแบบ เมื่อสำเร็จไปที่ `?next=` ถ้ามี ไม่เช่นนั้นผู้ดูแลไปที่ `/admin/projects` และผู้ใช้ไปที่ `/` |
| [NotFound.tsx](frontend/src/pages/NotFound.tsx) | เส้นทางที่ไม่รู้จัก | หน้า 404 |
| [admin/Projects.tsx](frontend/src/pages/admin/Projects.tsx) | `/admin/projects` | ตารางเรื่องทั้งหมดรวมฉบับร่าง พร้อมปุ่มแก้ไข คำตอบ (จำนวน) และลบ (ต้องยืนยัน) |
| [admin/ProjectEditor.tsx](frontend/src/pages/admin/ProjectEditor.tsx) | `/admin/projects/new`, `/admin/projects/:id/edit` | ชื่อเรื่อง รายละเอียด rich text เอกสาร PDF หัวข้อ (เพิ่ม ลบ เลื่อนขึ้น/ลง แสดงจำนวนคนที่ตอบแล้ว) และสถานะ เรื่องใหม่ PDF ที่เลือกจะอัปโหลดหลังบันทึกครั้งแรก |
| [admin/ProjectResponses.tsx](frontend/src/pages/admin/ProjectResponses.tsx) | `/admin/projects/:id/responses` | สรุปผลรายหัวข้อ (กราฟแท่ง เห็นด้วย/ไม่เห็นด้วย, จำนวนความเห็นเพิ่มเติม, หน่วยงานที่ถูกระบุเรียงจากมากไปน้อย) และการ์ดคำตอบแต่ละคน พร้อมค้นหาชื่อ ช่วงวันที่ (นับรวมทั้งสองวัน) และปุ่มลบ |
| [admin/Users.tsx](frontend/src/pages/admin/Users.tsx) | `/admin/users` | ค้นหา แบ่งหน้า ฟอร์มเพิ่ม/แก้ไข (ชื่อ อีเมล เบอร์โทร รีเซ็ตรหัสผ่าน สิทธิ์ สถานะ) และปุ่มลบ (ปิดการใช้งาน) |

## `nginx/`: reverse proxy

| ไฟล์ | หน้าที่ |
| --- | --- |
| [Dockerfile](nginx/Dockerfile) | มี 2 ขั้น: build frontend ด้วย Node 22 (`npm ci` แล้ว `npm run build`) จากนั้นคัดลอก `dist/` ไปไว้ใน image Nginx ใช้ root ของโปรเจกต์เป็น build context |
| [nginx.conf](nginx/nginx.conf) | Proxy `/api/` ไปที่ `api:3001` จำกัดการเข้าสู่ระบบและสมัครสมาชิก (10 ครั้งต่อนาทีต่อ IP) ให้บริการ `/uploads/` จาก volume ที่ใช้ร่วมกัน cache ไฟล์ `/assets/` ที่มี hash ไว้ 1 ปี ส่งเส้นทางที่ไม่รู้จักไปที่ `index.html` ให้ React Router จัดการ เพิ่ม security header และจำกัดขนาดคำขอที่ 11 MB |

## ลำดับการทำงานของคำขอ

**ผู้เยี่ยมชมตอบแบบรับฟังความคิดเห็น**

1. `ProjectDetail.tsx` เห็นว่ายังไม่มีผู้ใช้ จึงบันทึกร่างใน `sessionStorage` และพาไปที่ `/login?next=/projects/<id>`
2. `AuthPage.tsx` ส่งคำขอไปที่ `/api/auth/login` แล้ว `routes/auth.ts` ตรวจรหัสผ่านและตั้งคุกกี้ `token`
3. ผู้ใช้ถูกพากลับมาที่เรื่อง และร่างถูกใส่กลับในฟอร์ม
4. กดส่งจะเรียก `PUT /api/projects/<id>/response` โดย `authPlugin` อ่านคุกกี้, `cleanTopicAnswers()` ตรวจว่าตอบครบทุกหัวข้อ และ `saveResponse()` บันทึกใน transaction เดียว

**ผู้ดูแลสร้างเรื่องพร้อม PDF**

1. `ProjectEditor.tsx` ส่งชื่อเรื่อง HTML สถานะ และหัวข้อไปที่ `POST /api/admin/projects`
2. `routes/admin.ts` กรอง HTML ด้วย `sanitizeRichText()` สร้างเรื่องและหัวข้อด้วย `syncSummaryTopics()` และตรวจว่าเรื่องที่เปิดรับฟังมีหัวข้ออย่างน้อย 1 ข้อ
3. PDF ที่เลือกถูกส่งไปที่ `PUT /api/admin/projects/<id>/pdf` ซึ่ง `savePdf()` ตรวจไฟล์และเขียนลง volume `uploads`
4. Nginx ให้บริการไฟล์ที่ `/uploads/posts/<uuid>.pdf` จาก volume เดียวกัน และหน้าเรื่องแสดงด้วย `PdfViewer`

## จะแก้อะไร ต้องไปที่ไฟล์ไหน

| ต้องการเปลี่ยน | ไฟล์ |
| --- | --- |
| เพิ่มฟิลด์หรือตารางในฐานข้อมูล | `backend/prisma/schema.prisma` แล้วรัน `bunx prisma migrate dev --name <change>` |
| เพิ่ม endpoint สาธารณะ | `backend/src/routes/projects.ts` (หรือไฟล์ใหม่ที่ลงทะเบียนใน `src/index.ts`) |
| เพิ่ม endpoint ของผู้ดูแล | `backend/src/routes/admin.ts` |
| เปลี่ยนกฎการตอบหรือการบันทึกคำตอบ | `backend/src/lib/projects.ts` |
| เปลี่ยนความยาวสูงสุดของความเห็น/หน่วยงาน | `MAX_COMMENT_LENGTH` / `MAX_AGENCY_LENGTH` ทั้งใน `backend/src/lib/projects.ts` และ `frontend/src/lib/api.ts` |
| เปลี่ยนรายชื่อหน่วยงาน | `frontend/src/data/ministries_th.json` |
| เปลี่ยนจำนวนหัวข้อเริ่มต้นของเรื่องใหม่ | `DEFAULT_TOPIC_COUNT` ใน `frontend/src/lib/api.ts` |
| เปลี่ยนขนาดไฟล์ PDF สูงสุด | `MAX_PDF_BYTES` ใน `backend/src/lib/uploads.ts` และ `client_max_body_size` ใน `nginx/nginx.conf` |
| อนุญาต HTML เพิ่มในรายละเอียดเรื่อง | `RICH_TEXT_OPTIONS` ใน `backend/src/lib/html.ts` (และปุ่มในแถบเครื่องมือของ `RichTextEditor.tsx`) |
| เพิ่มหน้าใหม่ | `frontend/src/pages/` แล้วเพิ่มเส้นทางใน `frontend/src/App.tsx` |
| เพิ่ม type ของ API response | `frontend/src/lib/api.ts` |
| เปลี่ยนชื่อเว็บไซต์ | `frontend/src/lib/site.ts` และ `<title>` ใน `frontend/index.html` |
| เปลี่ยนสไตล์ | `frontend/src/styles.css` |
| เปลี่ยน proxy, cache, การจำกัดคำขอ หรือ HTTPS | `nginx/nginx.conf` |
