# ประชาพิจารณ์ สมุดปกขาว (ORST Public Hearing)

ระบบรับฟังความคิดเห็นสาธารณะต่อร่างสมุดปกขาว (White Paper) ผู้ดูแลระบบสร้าง **เรื่องรับฟังความคิดเห็น** (รายละเอียดแบบ rich text, เอกสาร PDF 1 ไฟล์ และ **หัวข้อ** ให้ตอบ “เห็นด้วย / ไม่เห็นด้วย”) ประชาชนอ่านได้โดยไม่ต้องเข้าสู่ระบบ ส่วนผู้ที่สมัครสมาชิกแล้วตอบแบบรับฟังความคิดเห็นได้ ผู้ดูแลดูคำตอบทั้งหมดพร้อมสรุปผลรายหัวข้อ

| ส่วน | เทคโนโลยี | โฟลเดอร์ | URL (ผ่าน Nginx) |
| --- | --- | --- | --- |
| Frontend | React 19 + React Router 7 + Vite + TipTap (แอปเดียว) | `frontend/` | `/` (ผู้ดูแลอยู่ใต้ `/admin/*`) |
| Backend API | ElysiaJS (Bun) + Prisma 6 | `backend/` | `/api/*` |
| ฐานข้อมูล | PostgreSQL 16 | — | ภายในเท่านั้น (โหมด dev เปิดพอร์ต 5432) |
| ที่เก็บไฟล์ | ดิสก์ (Docker volume `uploads`) | — | `/uploads/*` |
| Reverse proxy | Nginx (build และให้บริการ frontend ด้วย) | `nginx/` | พอร์ต `HTTP_PORT` (ค่าเริ่มต้น 80) |

ทุกส่วนอยู่บน origin เดียวกัน คุกกี้ session แบบ httpOnly จึงใช้งานได้โดยไม่ต้องตั้งค่า CORS รายละเอียดว่าแต่ละไฟล์ทำอะไร ดูที่ [structure.md](structure.md)

## การทำงานของแบบรับฟังความคิดเห็น

- แต่ละเรื่องมีสถานะ **ฉบับร่าง** (ไม่แสดงต่อสาธารณะ), **เปิดรับฟังความคิดเห็น** (รับคำตอบ) หรือ **ปิดรับฟังความคิดเห็นแล้ว** (แสดงเรื่องแต่ไม่รับคำตอบ)
- เรื่องใหม่เริ่มต้นด้วยหัวข้อ 3 หัวข้อ ผู้ดูแลเพิ่ม ลบ และเรียงลำดับได้ เรื่องต้องมีอย่างน้อย 1 หัวข้อจึงจะเปิดรับฟังได้
- ผู้ตอบต้องเลือก “เห็นด้วย” หรือ “ไม่เห็นด้วย” **ทุกหัวข้อ** ถ้าเห็นด้วย ใส่ **ความเห็นเพิ่มเติม** และเลือก **หน่วยงานที่เกี่ยวข้อง** (รายชื่อกระทรวง หรือพิมพ์เองในช่อง “อื่น ๆ”) ได้โดยไม่บังคับ
- ผู้ใช้ 1 คนมีคำตอบได้ 1 ชุดต่อเรื่อง แก้ไขหรือถอนคำตอบได้จนกว่าเรื่องจะปิด และเลือก “ไม่ประสงค์ให้เปิดเผยชื่อ” ได้
- ผู้เยี่ยมชมกรอกคำตอบได้ก่อน เมื่อกดส่งระบบจะเก็บร่างไว้ พาไปเข้าสู่ระบบ แล้วกลับมาพร้อมคำตอบเดิม

## สิทธิ์การใช้งาน

| | ผู้เยี่ยมชม | ผู้ใช้ | ผู้ดูแลระบบ |
| --- | :-: | :-: | :-: |
| ดูหน้าแรกและอ่านเรื่องที่เปิด/ปิดรับฟังแล้ว | ✅ | ✅ | ✅ |
| ส่ง แก้ไข และถอนคำตอบของตนเอง (ขณะเปิดรับฟัง) | – | ✅ | ✅ |
| ดูคำตอบ | – | เฉพาะของตนเอง | ทั้งหมด พร้อมสรุปผล |
| สร้าง แก้ไข ลบเรื่อง หัวข้อ และเอกสาร PDF | – | – | ✅ |
| ลบคำตอบของผู้อื่น | – | – | ✅ |
| เพิ่ม แก้ไข และปิดการใช้งานบัญชีผู้ใช้ | – | – | ✅ |

ผู้ใช้สมัครด้วย **ชื่อ นามสกุล อีเมล เบอร์โทรศัพท์ และรหัสผ่าน** (อย่างน้อย 8 ตัวอักษร) แล้วเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน ผู้ดูแลใช้หน้า `/login` เดียวกันและจะถูกพาไปที่ `/admin/projects`

บัญชีผู้ดูแลคนแรกสร้างจาก `ADMIN_EMAIL` / `ADMIN_PASSWORD` ตอน API เริ่มทำงาน ถ้ามีบัญชีอีเมลนั้นอยู่แล้ว ระบบจะตั้งให้เป็นผู้ดูแลและเปิดใช้งาน แต่ **จะไม่เปลี่ยนรหัสผ่าน** หากต้องการเปลี่ยนรหัสผ่านภายหลังให้แก้ในหน้า `/admin/users`

การ “ลบ” ผู้ใช้เป็นการปิดการใช้งาน (soft delete): เข้าสู่ระบบไม่ได้และ session เดิมใช้ไม่ได้ทันที แต่คำตอบยังอยู่ ผู้ดูแลเปิดใช้งานคืนได้

## แผนผังเว็บไซต์

| เส้นทาง | สิทธิ์ | หน้า |
| --- | --- | --- |
| `/` | ทุกคน | หน้าแรก: แบนเนอร์พร้อมช่องค้นหา และการ์ดเรื่องที่เปิด/ปิดรับฟัง (แสดง “คุณตอบแล้ว” ถ้าตอบแล้ว) |
| `/projects/:id` | ทุกคน | รายละเอียดเรื่อง ตัวแสดง PDF และแบบรับฟังความคิดเห็น |
| `/posts/:id` | ทุกคน | ลิงก์รุ่นเก่า พาไปที่ `/projects/:id` |
| `/login`, `/register` | ทุกคน | เข้าสู่ระบบ / สมัครสมาชิก (รองรับ `?next=` เพื่อกลับไปหน้าเดิม) |
| `/admin/projects` | ผู้ดูแล | ตารางเรื่องทั้งหมด (รวมฉบับร่าง) พร้อมปุ่มแก้ไข ดูคำตอบ และลบ |
| `/admin/projects/new`, `/admin/projects/:id/edit` | ผู้ดูแล | แก้ไขชื่อเรื่อง รายละเอียด เอกสาร PDF หัวข้อ และสถานะ |
| `/admin/projects/:id/responses` | ผู้ดูแล | สรุปผลรายหัวข้อ (กราฟเห็นด้วย/ไม่เห็นด้วย, จำนวนความเห็นเพิ่มเติม, หน่วยงานที่ถูกระบุ) และคำตอบทั้งหมด ค้นหาด้วยชื่อและช่วงวันที่ได้ |
| `/admin/users` | ผู้ดูแล | ค้นหา เพิ่ม แก้ไข รีเซ็ตรหัสผ่าน เปลี่ยนสิทธิ์ และปิดการใช้งานบัญชี |

ผู้ที่ไม่ใช่ผู้ดูแลจะไม่เห็นลิงก์ของผู้ดูแล ถ้าเปิด `/admin/*` ผู้เยี่ยมชมจะถูกพาไปหน้าเข้าสู่ระบบ และผู้ใช้ทั่วไปถูกพาไปที่ `/` นอกจากนี้ทุก endpoint `/api/admin/*` ตรวจสิทธิ์ที่ฝั่งเซิร์ฟเวอร์อีกชั้น

## โครงสร้างฐานข้อมูล

กำหนดไว้ใน [backend/prisma/schema.prisma](backend/prisma/schema.prisma)

```
User          id, firstName, lastName, email (unique), passwordHash, phone, role (ADMIN|USER),
              status (ACTIVE|INACTIVE), createdAt, updatedAt
Project       id, title, description (sanitized HTML), pdfUrl, status (DRAFT|OPEN|CLOSED),
              createdById → User, createdAt, updatedAt
SummaryTopic  id, projectId → Project (CASCADE), title, order (unique ต่อเรื่อง), createdAt, updatedAt
Response      id, projectId → Project (CASCADE), userId → User (CASCADE), isAnonymous, createdAt
              unique (projectId, userId): ผู้ใช้ 1 คนตอบได้ 1 ครั้งต่อเรื่อง
TopicAnswer   id, responseId → Response (CASCADE), summaryTopicId → SummaryTopic (CASCADE),
              agreement, additionalComment, relatedAgency, createdAt, updatedAt
              CHECK: additionalComment และ relatedAgency มีได้เฉพาะเมื่อ agreement = true
```

- ลบเรื่อง: หัวข้อ คำตอบ และไฟล์ PDF บนดิสก์ของเรื่องนั้นถูกลบด้วย
- ลบหัวข้อ (ในหน้าแก้ไขเรื่อง): คำตอบของหัวข้อนั้นถูกลบเมื่อกดบันทึก

## API endpoints

| Method | Path | สิทธิ์ |
| --- | --- | --- |
| GET | `/api/health` | ทุกคน |
| POST | `/api/auth/register` `{firstName,lastName,email,phone,password}` | ทุกคน |
| POST | `/api/auth/login` `{email,password}` | ทุกคน |
| POST | `/api/auth/logout` | ทุกคน |
| GET | `/api/auth/me` | ทุกคน |
| GET | `/api/projects` (เรื่องที่เปิด/ปิดรับฟัง พร้อมข้อความย่อ และ `responded`) | ทุกคน |
| GET | `/api/projects/:id` (รายละเอียด, PDF, หัวข้อ) | ทุกคน |
| GET, PUT, DELETE | `/api/projects/:id/response` คำตอบของตนเอง; PUT `{isAnonymous, topicAnswers[]}` | ผู้ใช้ (PUT/DELETE เฉพาะเรื่องที่เปิดอยู่) |
| GET, POST | `/api/admin/projects` | ผู้ดูแล |
| GET, PATCH, DELETE | `/api/admin/projects/:id` (POST/PATCH รับ `summaryTopics[]`) | ผู้ดูแล |
| PUT, DELETE | `/api/admin/projects/:id/pdf` (PUT เป็น multipart `file`, อัปโหลดซ้ำคือแทนที่) | ผู้ดูแล |
| GET | `/api/admin/projects/:id/responses?q=&from=&to=&page=` (ค้นหาชื่อ, ช่วงเวลาแบบ ISO) | ผู้ดูแล |
| GET | `/api/admin/projects/:id/summary` (สรุปผลรายหัวข้อ) | ผู้ดูแล |
| DELETE | `/api/admin/responses/:id` | ผู้ดูแล |
| GET, POST | `/api/admin/users?q=&page=` | ผู้ดูแล |
| PATCH, DELETE | `/api/admin/users/:id` (DELETE คือปิดการใช้งาน) | ผู้ดูแล |

Error ทุกตัวตอบเป็น `{ "error": "<ข้อความภาษาไทย>" }`

**ความปลอดภัย**
- รหัสผ่านถูกแฮชด้วย argon2id (`Bun.password`)
- Session เป็น JWT อายุ 7 วัน เก็บในคุกกี้ httpOnly แบบ SameSite=Lax ทุกคำขอตรวจสถานะบัญชีจากฐานข้อมูล บัญชีที่ถูกปิดจึงหลุดจากระบบทันที
- HTML รายละเอียดเรื่องถูกกรองด้วย allow-list ที่เซิร์ฟเวอร์ก่อนบันทึก
- รับเฉพาะไฟล์ PDF ขนาดไม่เกิน 10 MB ตรวจทั้งนามสกุลและ magic bytes (`%PDF-`) และเก็บด้วยชื่อสุ่ม
- Nginx จำกัดการเข้าสู่ระบบและสมัครสมาชิกที่ 10 ครั้งต่อนาทีต่อ IP และเพิ่ม security header
- คำตอบเป็นข้อมูลส่วนตัว: ผู้ใช้เห็นเฉพาะของตนเอง ผู้ดูแลดูผ่าน `/api/admin/*`
- ผู้ดูแลไม่สามารถลดสิทธิ์ ปิดการใช้งาน หรือลบบัญชีของตนเองได้
- ในโหมด production API จะไม่ยอมเริ่มทำงานถ้า `JWT_SECRET` สั้นกว่า 32 ตัวอักษร หรือ `JWT_SECRET` / `ADMIN_PASSWORD` ยังเป็น `CHANGE_ME`

## Deploy ขึ้น production (เซิร์ฟเวอร์ Debian)

### 1. ติดตั้ง Docker

```bash
# Docker Engine + Compose plugin (https://docs.docker.com/engine/install/debian/)
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 2. ตั้งค่า

```bash
git clone <repo-url> orst_public-hearing && cd orst_public-hearing
cp .env.example .env
openssl rand -hex 32   # ใช้เป็น JWT_SECRET
nano .env              # ตั้ง POSTGRES_PASSWORD, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
```

### 3. เริ่มระบบ

```bash
docker compose up -d --build
docker compose logs -f api   # migration รันอัตโนมัติ ควรเห็น "API listening on http://0.0.0.0:3001"
```

เปิด `http://<server-ip>/` แล้วเข้าสู่ระบบด้วยบัญชีผู้ดูแล ระบบจะพาไปที่ `/admin/projects`

> **บนเซิร์ฟเวอร์ใช้ `docker compose` กับ `docker-compose.yml` อย่างเดียว** ห้ามใช้ `docker-compose.dev.yml` เพราะจะเปิดพอร์ตฐานข้อมูล (5432) และ API (3001) สู่ภายนอก

### Checklist ก่อนเปิดใช้งานจริง

- [ ] `.env` ไม่มีค่า `CHANGE_ME` เหลืออยู่ และ `POSTGRES_PASSWORD` / `ADMIN_PASSWORD` เป็นรหัสผ่านที่คาดเดายาก
- [ ] เปิด HTTPS แล้ว และตั้ง `COOKIE_SECURE=true` (ดูหัวข้อถัดไป)
- [ ] Firewall เปิดเฉพาะพอร์ต 22, 80 และ 443
- [ ] ตั้ง cron สำรองข้อมูล (ฐานข้อมูลและไฟล์อัปโหลด) และทดลองกู้คืนแล้วอย่างน้อย 1 ครั้ง
- [ ] เข้าสู่ระบบด้วยบัญชีผู้ดูแลได้ สร้างเรื่องทดสอบ อัปโหลด PDF และตอบแบบรับฟังด้วยบัญชีผู้ใช้ได้

### HTTPS

Container Nginx ฟังแค่พอร์ต 80 เลือกได้ 2 แบบ:

1. **วาง reverse proxy อีกตัวไว้หน้า** (เช่น Caddy หรือ Nginx บนเครื่อง พร้อม certbot) แล้วตั้ง `HTTP_PORT=8080` ใน `.env` ให้ proxy ภายนอกส่งต่อมาที่ `127.0.0.1:8080`
   ในกรณีนี้ IP ที่ Nginx ภายในเห็นจะเป็น IP ของ proxy ทำให้ผู้ใช้ทุกคนใช้โควตาจำกัดการเข้าสู่ระบบร่วมกัน ให้เพิ่มใน `server` ของ [nginx/nginx.conf](nginx/nginx.conf):
   ```nginx
   set_real_ip_from 172.16.0.0/12;   # เครือข่าย Docker / IP ของ proxy ภายนอก
   real_ip_header X-Forwarded-For;
   ```
2. **เพิ่ม TLS ใน container Nginx เอง**: เพิ่ม server block `listen 443 ssl` ใน `nginx.conf`, mount ใบรับรองเข้า container และเปิดพอร์ต 443 ใน `docker-compose.yml`

จากนั้นตั้ง `COOKIE_SECURE=true` ใน `.env` แล้วรัน `docker compose up -d` เมื่อใช้ HTTPS ได้เสถียรแล้ว ควรเพิ่ม header `Strict-Transport-Security` ด้วย

### อัปเดตเวอร์ชัน

```bash
git pull
docker compose up -d --build   # migration ใหม่รันอัตโนมัติตอน API เริ่ม
docker image prune -f          # ลบ image เก่า
```

### สำรองและกู้คืนข้อมูล

ข้อมูลอยู่ใน volume 2 ตัว: `orst_e-feedback_pgdata` (ฐานข้อมูล) และ `orst_e-feedback_uploads` (ไฟล์ PDF) ค่าด้านล่างใช้ `POSTGRES_USER=postgres` และ `POSTGRES_DB=public-hearing` ตาม `.env.example`

```bash
# สำรอง
docker compose exec -T db pg_dump -U postgres -Fc public-hearing > backup-$(date +%F).dump
docker run --rm -v orst_e-feedback_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads-$(date +%F).tgz -C /data .

# กู้คืน (เขียนทับข้อมูลเดิม)
docker compose exec -T db pg_restore -U postgres -d public-hearing --clean --if-exists < backup-YYYY-MM-DD.dump
docker run --rm -v orst_e-feedback_uploads:/data -v "$PWD":/backup alpine tar xzf /backup/uploads-YYYY-MM-DD.tgz -C /data
```

ชื่อโปรเจกต์ Docker Compose ถูกกำหนดเป็น `orst_e-feedback` ใน `docker-compose.yml` เพื่อให้ชื่อ container และ volume ไม่เปลี่ยนแม้เปลี่ยนชื่อโฟลเดอร์ Log ของแต่ละ container ถูกจำกัดไว้ที่ 5 ไฟล์ × 10 MB

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

บนเครื่องเดียวกัน โหมด dev และ production ใช้ฐานข้อมูลและไฟล์อัปโหลดชุดเดียวกัน

**เปิดฐานข้อมูลด้วย DBeaver (หรือโปรแกรมอื่น)**: โหมด dev เปิด PostgreSQL ที่ `localhost:5432` ใช้ Database, Username และ Password ตาม `POSTGRES_DB`, `POSTGRES_USER` และ `POSTGRES_PASSWORD` ใน `.env`

## พัฒนาโดยไม่ใช้ Docker

ต้องมี [Bun](https://bun.sh) และ Node.js 20 ขึ้นไป

```bash
# ฐานข้อมูลอย่างเดียว
docker compose up -d db              # หรือใช้ PostgreSQL ในเครื่อง

# API (http://localhost:3001)
cd backend && cp .env.example .env   # แก้ DATABASE_URL
bun install && bunx prisma migrate dev && bun run dev

# Frontend (http://localhost:5173) ซึ่ง proxy /api และ /uploads ไปที่ :3001
cd frontend && npm install && npm run dev
```

ตรวจ type ก่อน commit: `cd backend && bun run typecheck` และ `cd frontend && npm run build`

## เปลี่ยนโครงสร้างฐานข้อมูล

แก้ `backend/prisma/schema.prisma` แล้วรัน `bunx prisma migrate dev --name <change>` จากนั้น commit ไฟล์ migration ที่ได้ ฝั่ง production จะรัน `prisma migrate deploy` ให้เองตอน container เริ่มทำงาน **ห้ามแก้ไฟล์ migration ที่ deploy ไปแล้ว** ให้สร้าง migration ใหม่เสมอ
