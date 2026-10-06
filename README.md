# ประชาพิจารณ์ สมุดปกขาว (ORST Public Hearing)

ระบบรับฟังความคิดเห็นสาธารณะ ผู้ดูแลระบบเผยแพร่เรื่อง (บทความแบบ rich text พร้อมไฟล์แนบ เช่น PDF) และจัดการบัญชีผู้ใช้ ทุกคนอ่านเรื่องที่เผยแพร่ได้ ส่วนผู้ใช้ที่สมัครสมาชิกแล้วแสดงความคิดเห็นได้

| ส่วน | เทคโนโลยี | โฟลเดอร์ | URL (ผ่าน Nginx) |
| --- | --- | --- | --- |
| Frontend | React + Vite + TipTap (แอปเดียว) | `frontend/` | `/` (ผู้ดูแลอยู่ใต้ `/admin/*`) |
| Backend API | ElysiaJS (Bun) + Prisma | `backend/` | `/api/*` |
| ฐานข้อมูล | PostgreSQL 16 | — | ภายในเท่านั้น (โหมด dev เปิดพอร์ต 5432) |
| ที่เก็บไฟล์ | ดิสก์ในเครื่อง (Docker volume) | volume `uploads` | `/uploads/*` |
| Reverse proxy | Nginx (ให้บริการ frontend ด้วย) | `nginx/` | พอร์ต 80 |

ทุกส่วนอยู่บน origin เดียวกัน คุกกี้ session แบบ httpOnly จึงใช้งานได้โดยไม่ต้องตั้งค่า CORS

## สิทธิ์การใช้งาน

| | ผู้เยี่ยมชม | ผู้ใช้ | ผู้ดูแลระบบ |
| --- | :-: | :-: | :-: |
| ดูหน้าแรกและอ่านเรื่องที่เผยแพร่ | ✅ | ✅ | ✅ |
| แสดงความคิดเห็น (ผู้เยี่ยมชมที่กดส่งจะถูกพาไปหน้า `/login`) | – | ✅ | ✅ |
| ดูความคิดเห็นในเรื่อง | – | เฉพาะของตนเอง | ทั้งหมด |
| ลบความคิดเห็นของตนเอง | – | ✅ | ✅ |
| สร้าง แก้ไข ลบเรื่อง และอัปโหลดไฟล์แนบ | – | – | ✅ |
| ดูและลบความคิดเห็นในทุกเรื่อง | – | – | ✅ |
| เพิ่ม แก้ไข และลบบัญชีผู้ใช้ | – | – | ✅ |

ผู้ใช้สมัครด้วย **ชื่อ นามสกุล อีเมล และรหัสผ่าน** แล้วเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน ผู้ดูแลระบบใช้หน้า `/login` เดียวกันและจะถูกพาไปที่ `/admin/posts` บัญชีผู้ดูแลคนแรกสร้างจาก `ADMIN_EMAIL` / `ADMIN_PASSWORD` ตอนที่ API เริ่มทำงาน

## แผนผังเว็บไซต์

| เส้นทาง | สิทธิ์ | หน้า |
| --- | --- | --- |
| `/` | ทุกคน | หน้าแรก: รายการเรื่องที่เผยแพร่ พร้อมช่องค้นหา |
| `/posts/:id` | ทุกคน | การ์ดด้านบนแสดงหัวข้อ วันที่เผยแพร่ และเนื้อหา ด้านล่างซ้ายเป็นตัวแสดง PDF และรายการความคิดเห็น ด้านขวาเป็นกล่องเขียนความคิดเห็น ผู้เยี่ยมชมที่กดส่งความคิดเห็นจะถูกบันทึกร่างไว้ พาไป `/login?next=/posts/:id` แล้วกลับมาพร้อมร่างเดิม |
| `/login` | ทุกคน | เข้าสู่ระบบสำหรับผู้ใช้และผู้ดูแล (มีลิงก์ไปสมัครสมาชิก) |
| `/register` | ทุกคน | สมัครสมาชิก |
| `/admin/posts` | ผู้ดูแล | เรื่องทั้งหมด (เผยแพร่แล้วและฉบับร่าง) พร้อมปุ่มแก้ไข ความคิดเห็น และลบ คลิกหัวข้อที่เผยแพร่แล้วเพื่อเปิดหน้าเรื่อง ผู้ดูแลจะมาที่หน้านี้หลังเข้าสู่ระบบ |
| `/admin/posts/new`, `/admin/posts/:id/edit` | ผู้ดูแล | ตัวแก้ไขเนื้อหาและไฟล์แนบ |
| `/admin/posts/:id/comments` | ผู้ดูแล | ความคิดเห็นของเรื่องในรูปแบบการ์ด (ข้อความ แล้วตามด้วยชื่อและวันที่) พร้อมปุ่มลบ ค้นหาด้วยชื่อและช่วงวันที่ได้ |
| `/admin/users` | ผู้ดูแล | บัญชีผู้ใช้ (เพิ่ม แก้ไข รีเซ็ตรหัสผ่าน ระงับ ลบ) |

ผู้ที่ไม่ใช่ผู้ดูแลจะไม่เห็นลิงก์ของผู้ดูแล หากเปิด URL `/admin/*` ผู้เยี่ยมชมจะถูกพาไปหน้าเข้าสู่ระบบ และผู้ใช้ทั่วไปจะถูกพาไปที่ `/` นอกจากนี้ทุก endpoint `/api/admin/*` ตรวจสอบสิทธิ์ที่ฝั่งเซิร์ฟเวอร์อีกชั้นหนึ่ง

## โครงสร้างฐานข้อมูล

กำหนดไว้ใน [backend/prisma/schema.prisma](backend/prisma/schema.prisma)

```
User        id, firstName, lastName, email (unique), passwordHash, role (USER|ADMIN), isBanned, createdAt, updatedAt
Post        id, title, content (sanitized HTML), isPublished, authorId → User (SET NULL), createdAt, updatedAt
Attachment  id, postId → Post (CASCADE), originalName, storedName (unique), mimeType, size, createdAt
Comment     id, content, userId → User (CASCADE), postId → Post (CASCADE), createdAt, updatedAt
```

- ลบเรื่อง: ความคิดเห็น ไฟล์แนบ และไฟล์บนดิสก์ของเรื่องนั้นจะถูกลบด้วย
- ลบผู้ใช้: ความคิดเห็นของผู้ใช้นั้นจะถูกลบ ส่วนเรื่องที่เขียนไว้ยังอยู่แต่ไม่มีชื่อผู้เขียน

## API endpoints

| Method | Path | สิทธิ์ |
| --- | --- | --- |
| POST | `/api/auth/register` `{firstName,lastName,email,password}` | ทุกคน |
| POST | `/api/auth/login` `{email,password}` | ทุกคน |
| POST | `/api/auth/logout` | ทุกคน |
| GET | `/api/auth/me` | ทุกคน |
| GET | `/api/posts` (เรื่องที่เผยแพร่ พร้อมข้อความย่อและภาพปก) | ทุกคน |
| GET | `/api/posts/:id` (เนื้อหาและไฟล์แนบ) | ทุกคน |
| GET | `/api/posts/:id/comments?page=` (ผู้ดูแล: ทั้งหมด, ผู้ใช้: ของตนเอง, ผู้เยี่ยมชม: ไม่มี) | ทุกคน |
| POST | `/api/posts/:id/comments` `{content}` | ผู้ใช้ |
| DELETE | `/api/comments/:id` | เจ้าของหรือผู้ดูแล |
| GET, POST | `/api/admin/posts` | ผู้ดูแล |
| GET, PATCH, DELETE | `/api/admin/posts/:id` | ผู้ดูแล |
| POST | `/api/admin/posts/:id/attachments` (multipart `file`) | ผู้ดูแล |
| DELETE | `/api/admin/attachments/:id` | ผู้ดูแล |
| GET | `/api/admin/posts/:id/comments?q=&from=&to=&page=` (ค้นหาชื่อ, ช่วงวันที่แบบ ISO) | ผู้ดูแล |
| DELETE | `/api/admin/comments/:id` | ผู้ดูแล |
| GET, POST | `/api/admin/users` | ผู้ดูแล |
| PATCH, DELETE | `/api/admin/users/:id` | ผู้ดูแล |

**ความปลอดภัย**
- รหัสผ่านถูกแฮชด้วย argon2id ของ Bun
- Session เป็น JWT เก็บในคุกกี้ httpOnly แบบ SameSite=Lax
- HTML ของเรื่องถูกกรองที่เซิร์ฟเวอร์ด้วย allow-list ก่อนบันทึก
- ไฟล์แนบรับเฉพาะรูปภาพ PDF ไฟล์ Office TXT CSV และ ZIP ขนาดไม่เกิน 10 MB ต่อไฟล์ และเก็บด้วยชื่อสุ่ม ไม่รับไฟล์ HTML และ SVG
- Nginx จำกัดจำนวนครั้งการเข้าสู่ระบบและสมัครสมาชิก
- ความคิดเห็นเป็นข้อมูลส่วนตัว: API ส่งเฉพาะความคิดเห็นที่ผู้เรียกมีสิทธิ์เห็น
- ผู้ดูแลไม่สามารถลบ ลดสิทธิ์ หรือระงับบัญชีของตนเองได้

## โครงสร้าง Frontend

```
frontend/src/
├── App.tsx                    เส้นทางทั้งหมด + เลื่อนขึ้นบนสุดเมื่อเปลี่ยนหน้า
├── lib/api.ts                 ตัวเรียก API, types, ฟังก์ชันจัดรูปแบบ
├── lib/auth.tsx               AuthProvider / useAuth, ตัวช่วย redirect ไปหน้าเข้าสู่ระบบ
├── lib/site.ts                ชื่อเว็บไซต์
├── components/
│   ├── PublicLayout.tsx       ส่วนหัว + เนื้อหาของหน้าสาธารณะ
│   ├── AdminLayout.tsx        ตรวจสิทธิ์ผู้ดูแล + แถบเมนูด้านข้าง
│   ├── RichTextEditor.tsx     ตัวแก้ไข TipTap พร้อมแถบเครื่องมือ
│   ├── AttachmentList.tsx     แกลเลอรีรูป + รายการไฟล์ (มีปุ่มลบได้)
│   ├── PdfViewer.tsx          แสดง PDF ในหน้าเว็บ
│   └── ui.tsx                 Pagination, ErrorBanner, Loading, Brand
└── pages/
    ├── PostList.tsx           หน้าแรก
    ├── PostDetail.tsx         หน้าเรื่อง + ความคิดเห็น
    ├── AuthPage.tsx           เข้าสู่ระบบ / สมัครสมาชิก
    ├── NotFound.tsx
    └── admin/
        ├── Posts.tsx
        ├── PostEditor.tsx
        ├── PostComments.tsx
        └── Users.tsx
```

## ติดตั้งบนเซิร์ฟเวอร์ Debian

```bash
# 1. ติดตั้ง Docker Engine + Compose plugin (https://docs.docker.com/engine/install/debian/)
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 2. ตั้งค่า
cp .env.example .env
nano .env           # ตั้ง POSTGRES_PASSWORD, JWT_SECRET (openssl rand -hex 32), ADMIN_EMAIL, ADMIN_PASSWORD

# 3. เริ่มระบบ
docker compose up -d --build
docker compose logs -f api   # migration จะรันอัตโนมัติตอนเริ่ม
```

เปิด `http://<server-ip>/` แล้วเข้าสู่ระบบด้วยบัญชีผู้ดูแล ระบบจะพาไปที่ `/admin/posts`

**HTTPS**: ติดตั้ง TLS หน้า Nginx (เช่น server block `listen 443 ssl` พร้อมใบรับรองจาก certbot) แล้วตั้ง `COOKIE_SECURE=true` ใน `.env`

**สำรองข้อมูล**: ข้อมูลอยู่ใน volume 2 ตัว

```bash
docker compose exec db pg_dump -U postgres public-hearing > backup.sql
docker run --rm -v orst_e-feedback_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads.tgz -C /data .
```

ชื่อโปรเจกต์ Docker Compose ถูกกำหนดไว้เป็น `orst_e-feedback` ใน `docker-compose.yml` เพื่อให้ container และ volume (ฐานข้อมูล ไฟล์อัปโหลด) ยังใช้ได้เหมือนเดิมแม้จะเปลี่ยนชื่อโฟลเดอร์โปรเจกต์

## พัฒนาแบบ live reload (ใช้ Docker อย่างเดียว)

ไม่ต้องติดตั้งอะไรนอกจาก Docker

```bash
docker compose down                                                   # หยุดโหมด production ถ้ากำลังรันอยู่
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d  # เริ่มโหมด dev
```

เปิด **http://localhost:5173**

- **Frontend:** บันทึกไฟล์ใน `frontend/src` แล้วเบราว์เซอร์จะอัปเดตทันที
- **Backend:** บันทึกไฟล์ใน `backend/src` หรือ `backend/prisma` แล้ว API จะรีสตาร์ตภายในประมาณ 2 วินาที
- **Log:** `docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f api frontend`
- **กลับไปโหมด production:** `docker compose -f docker-compose.yml -f docker-compose.dev.yml down` แล้ว `docker compose up -d --build`

โหมด dev และ production ใช้ฐานข้อมูลและไฟล์อัปโหลดชุดเดียวกัน

**เปิดฐานข้อมูลด้วย DBeaver (หรือโปรแกรมอื่น)**: โหมด dev เปิดพอร์ต PostgreSQL ไว้ที่ `localhost:5432` ใช้ Database, Username และ Password ตามค่า `POSTGRES_DB`, `POSTGRES_USER` และ `POSTGRES_PASSWORD` ใน `.env`

## พัฒนาโดยไม่ใช้ Docker

ต้องมี [Bun](https://bun.sh) และ Node.js 20 ขึ้นไป

```bash
# ฐานข้อมูลอย่างเดียว
docker compose up -d db              # ต้องมี .env หรือใช้ PostgreSQL ในเครื่องก็ได้

# API (http://localhost:3001)
cd backend && cp .env.example .env   # แก้ DATABASE_URL
bun install && bunx prisma migrate dev && bun run dev

# Frontend (http://localhost:5173) ซึ่ง proxy /api และ /uploads ไปที่ :3001
cd frontend && npm install && npm run dev
```

หากต้องการเปลี่ยนโครงสร้างฐานข้อมูล ให้แก้ `backend/prisma/schema.prisma` แล้วรัน `bunx prisma migrate dev --name <change>` จากนั้น commit ไฟล์ migration ที่ได้ ฝั่ง production จะรัน `prisma migrate deploy` ให้เองตอน container เริ่มทำงาน
