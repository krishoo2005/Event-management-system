import express from 'express';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// SQLite Connection
const db = new Database('event_management.db');

function initDB() {
    try {
        // 1️⃣ Users Table (Merged user schema with existing functionality)
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                admin_pin TEXT,
                otp TEXT,
                otp_expiry DATETIME
            )
        `);

        // 2️⃣ Events Table
        db.exec(`
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                image TEXT,
                date TEXT NOT NULL,
                time TEXT,
                place TEXT NOT NULL,
                price INTEGER NOT NULL,
                is_past INTEGER DEFAULT 0
            )
        `);

        // 3️⃣ Enrollments Table
        db.exec(`
            CREATE TABLE IF NOT EXISTS enrollments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                user_email TEXT,
                event_id INTEGER,
                amount INTEGER,
                paid INTEGER DEFAULT 0,
                remaining_amount INTEGER DEFAULT 0,
                payment_status TEXT DEFAULT 'pending',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            )
        `);

        // Seed Admin
        const admin = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
        if (!admin) {
            db.prepare("INSERT INTO users (name, email, password, role, admin_pin) VALUES (?, ?, ?, ?, ?)")
                .run("Admin", "admin@eventify.com", "admin123", "admin", "1234");
        }

        // Seed Events
        const eventCount = db.prepare("SELECT COUNT(*) as count FROM events").get().count;
        if (eventCount === 0) {
            const events = [
                ["Football Championship", "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=800", "2026-05-15", "10:00 AM", "Main Stadium", 150, 0],
                ["Music Festival", "https://images.unsplash.com/photo-1459749411177-042180ce673c?auto=format&fit=crop&q=80&w=800", "2026-06-20", "02:00 PM", "Open Air Grounds", 120, 0],
                ["Cricket Tournament", "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=800", "2026-07-10", "09:00 AM", "City Arena", 180, 0],
                ["Chess Grandmaster", "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&q=80&w=800", "2026-08-05", "11:00 AM", "Grand Hall", 100, 0],
                ["Annual Gathering", "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800", "2026-09-12", "01:00 PM", "Auditorium", 140, 0],
                ["Carrom Cup", "https://images.unsplash.com/photo-1628102428621-238244389981?auto=format&fit=crop&q=80&w=800", "2025-11-10", "10:00 AM", "Indoor Club", 50, 1],
                ["Volleyball League", "https://images.unsplash.com/photo-1592656094267-764a45160876?auto=format&fit=crop&q=80&w=800", "2025-12-05", "02:00 PM", "Beach Court", 80, 1],
                ["Kabaddi Pro", "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=800", "2025-10-20", "09:00 AM", "Sports Complex", 90, 1],
                ["Singing Idol", "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&q=80&w=800", "2025-09-15", "04:00 PM", "Theater", 70, 1]
            ];
            const insert = db.prepare("INSERT INTO events (title, image, date, time, place, price, is_past) VALUES (?, ?, ?, ?, ?, ?, ?)");
            for (const event of events) {
                insert.run(...event);
            }
        }

        console.log("SQLite Connected & Initialized");
    } catch (error) {
        console.error("Database Error:", error.message);
    }
}

// Auth Routes
app.post("/api/register", (req, res) => {
    const { email, password, name } = req.body;
    try {
        const info = db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)").run(email, password, name || '');
        res.json({ id: info.lastInsertRowid, email, role: 'user' });
    } catch (e) {
        console.error("Register Error:", e.message);
        res.status(400).json({ error: e.message.includes('UNIQUE') ? "User already exists" : "Registration failed" });
    }
});

app.post("/api/login", (req, res) => {
    const { email, password, pin } = req.body;
    try {
        const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password);
        if (user) {
            if (user.role === 'admin') {
                if (user.admin_pin !== pin) {
                    return res.status(401).json({ error: "Invalid Admin PIN" });
                }
            }
            res.json({ id: user.id, email: user.email, role: user.role });
        } else {
            res.status(401).json({ error: "Invalid credentials" });
        }
    } catch (e) {
        console.error("Login Error:", e.message);
        res.status(500).json({ error: "Server error" });
    }
});

// Forgot Password
app.post("/api/forgot-password", (req, res) => {
    const { email } = req.body;
    try {
        const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
        if (!user) return res.status(404).json({ error: "User not found" });

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiry = new Date(Date.now() + 10 * 60000).toISOString();

        db.prepare("UPDATE users SET otp = ?, otp_expiry = ? WHERE email = ?").run(otp, expiry, email);
        console.log(`OTP for ${email}: ${otp}`);
        res.json({ message: "OTP sent to email", demo_otp: otp });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/reset-password", (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        const user = db.prepare("SELECT * FROM users WHERE email = ? AND otp = ? AND otp_expiry > datetime('now')").get(email, otp);
        if (!user) return res.status(400).json({ error: "Invalid or expired OTP" });

        db.prepare("UPDATE users SET password = ?, otp = NULL, otp_expiry = NULL WHERE email = ?").run(newPassword, email);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Event Routes
app.get("/api/events", (req, res) => {
    try {
        const rows = db.prepare("SELECT * FROM events WHERE is_past = 0").all();
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: "Server error" });
    }
});

app.get("/api/events/past", (req, res) => {
    try {
        const rows = db.prepare("SELECT * FROM events WHERE is_past = 1").all();
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/api/admin/add-event", (req, res) => {
    const { title, image, date, time, place, price, is_past } = req.body;
    try {
        db.prepare("INSERT INTO events (title, image, date, time, place, price, is_past) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(title, image, date, time, place, price, is_past || 0);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Enrollment Routes
app.post("/api/enroll", (req, res) => {
    const { userId, eventId } = req.body;
    try {
        const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId);
        const event = db.prepare("SELECT price FROM events WHERE id = ?").get(eventId);
        
        const existing = db.prepare("SELECT * FROM enrollments WHERE user_id = ? AND event_id = ?").get(userId, eventId);
        if (existing) {
            return res.status(400).json({ error: "Already enrolled" });
        }
        
        db.prepare("INSERT INTO enrollments (user_id, user_email, event_id, amount, remaining_amount) VALUES (?, ?, ?, ?, ?)")
            .run(userId, user.email, eventId, event.price, event.price);
        res.json({ success: true });
    } catch (e) {
        console.error("Enroll Error:", e.message);
        res.status(500).json({ error: "Server error" });
    }
});

app.delete("/api/enrollments/:id", (req, res) => {
    try {
        db.prepare("DELETE FROM enrollments WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/enrollments/:userId", (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT en.*, ev.title, ev.price 
            FROM enrollments en 
            JOIN events ev ON en.event_id = ev.id 
            WHERE en.user_id = ?
        `).all(req.params.userId);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: "Server error" });
    }
});

// Payment Routes
app.post("/api/pay", (req, res) => {
    const { enrollmentId, amount } = req.body;
    try {
        const enrollment = db.prepare("SELECT remaining_amount, paid FROM enrollments WHERE id = ?").get(enrollmentId);
        const newPaid = parseFloat(enrollment.paid) + parseFloat(amount);
        const newRemaining = parseFloat(enrollment.remaining_amount) - parseFloat(amount);
        
        const status = newRemaining <= 0 ? 'paid' : 'partial';
        
        db.prepare("UPDATE enrollments SET paid = ?, remaining_amount = ?, payment_status = ? WHERE id = ?")
            .run(newPaid, Math.max(0, newRemaining), status, enrollmentId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Server error" });
    }
});

// Admin Stats
app.get("/api/admin/stats", (req, res) => {
    try {
        const userCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").get().count;
        const revenue = db.prepare("SELECT SUM(paid) as total FROM enrollments").get().total || 0;
        
        const userStats = db.prepare(`
            SELECT 
                u.email, 
                u.password, 
                GROUP_CONCAT(ev.title, ', ') as events,
                SUM(en.paid) as total_paid,
                SUM(en.remaining_amount) as total_remaining
            FROM users u 
            LEFT JOIN enrollments en ON u.id = en.user_id 
            LEFT JOIN events ev ON en.event_id = ev.id
            WHERE u.role = 'user'
            GROUP BY u.id
            ORDER BY u.email
        `).all();

        const eventStats = db.prepare(`
            SELECT 
                ev.title,
                COUNT(en.id) as enrollments,
                SUM(en.paid) as revenue
            FROM events ev
            LEFT JOIN enrollments en ON ev.id = en.event_id
            GROUP BY ev.id
            ORDER BY enrollments DESC
        `).all();

        res.json({
            totalUsers: userCount,
            totalAmount: revenue,
            userStats,
            eventStats
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

initDB();
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server runnin+0.
        
        g on http://localhost:${PORT}`);
});
