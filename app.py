from flask import Flask, request, jsonify, send_from_directory, g
import sqlite3, os, uuid, base64, json
from datetime import datetime

app = Flask(__name__, static_folder='static', static_url_path='/static')
DB_PATH = os.path.join(os.path.dirname(__file__), 'events.db')

# ── DB helpers ──────────────────────────────────────────────────────────────

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop('db', None)
    if db: db.close()

def init_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.executescript("""
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            venue TEXT NOT NULL,
            description TEXT DEFAULT '',
            participants INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS schedules (
            id TEXT PRIMARY KEY,
            event_name TEXT NOT NULL,
            time TEXT NOT NULL,
            activity TEXT NOT NULL,
            speaker TEXT NOT NULL,
            venue TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS registrations (
            id TEXT PRIMARY KEY,
            event_name TEXT NOT NULL,
            student_name TEXT NOT NULL,
            college_name TEXT NOT NULL,
            roll_no TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            menu_preference TEXT DEFAULT '',
            participant_count INTEGER DEFAULT 1,
            participants_json TEXT DEFAULT '[]',
            payment_status TEXT DEFAULT 'pending',
            registered_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS notices (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS feedbacks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            event_name TEXT DEFAULT 'General',
            rating INTEGER NOT NULL,
            comments TEXT NOT NULL,
            submitted_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS brochures (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            linked_event TEXT DEFAULT '',
            description TEXT DEFAULT '',
            file_name TEXT DEFAULT '',
            file_data TEXT DEFAULT '',
            file_type TEXT DEFAULT '',
            uploaded_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS moments (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            type TEXT DEFAULT 'photo',
            linked_event TEXT DEFAULT '',
            description TEXT DEFAULT '',
            file_name TEXT DEFAULT '',
            file_data TEXT DEFAULT '',
            file_type TEXT DEFAULT '',
            uploaded_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS certificates (
            id TEXT PRIMARY KEY,
            event_id TEXT DEFAULT '',
            event_name TEXT NOT NULL,
            event_date TEXT NOT NULL,
            type TEXT NOT NULL,
            achievement TEXT DEFAULT '',
            org_name TEXT DEFAULT 'Event Management System',
            sig1_name TEXT DEFAULT '',
            sig1_title TEXT DEFAULT '',
            sig2_name TEXT DEFAULT '',
            sig2_title TEXT DEFAULT '',
            recipients_json TEXT DEFAULT '[]',
            published_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS payment_settings (
            id INTEGER PRIMARY KEY CHECK (id=1),
            qr_code TEXT DEFAULT '',
            upi_id TEXT DEFAULT '',
            upi_name TEXT DEFAULT '',
            bank_name TEXT DEFAULT '',
            account_number TEXT DEFAULT '',
            ifsc_code TEXT DEFAULT '',
            account_holder TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS admin (
            id INTEGER PRIMARY KEY CHECK (id=1),
            username TEXT DEFAULT 'admin',
            password TEXT DEFAULT 'admin123'
        );
        INSERT OR IGNORE INTO admin (id, username, password) VALUES (1,'admin','admin123');
        INSERT OR IGNORE INTO payment_settings (id, upi_id, upi_name, bank_name, account_number, ifsc_code, account_holder)
            VALUES (1,'events@paytm','Event Management System','State Bank of India','1234567890123','SBIN0001234','Event Management System');
    """)
    # seed sample data if empty
    row = db.execute("SELECT COUNT(*) as c FROM events").fetchone()
    if row['c'] == 0:
        db.executescript("""
            INSERT INTO events (id,name,date,venue,description,participants) VALUES
              ('ev1','Tech Conference 2025','2025-02-15T09:00:00','Main Auditorium','Annual technology conference',1),
              ('ev2','Cultural Fest','2025-03-20T16:00:00','Open Ground','Celebrate diversity with music, dance, and art',2),
              ('ev3','Hackathon 2025','2025-04-10T08:00:00','Computer Lab','24-hour hackathon',3);
            INSERT INTO schedules (id,event_name,time,activity,speaker,venue) VALUES
              ('sc1','Tech Conference 2025','09:00','Registration & Welcome Coffee','Event Team','Main Lobby'),
              ('sc2','Tech Conference 2025','10:00','Keynote: Future of AI','Dr. Sarah Johnson','Main Auditorium');
            INSERT INTO notices (id,title,description) VALUES
              ('no1','Registration Open','Event registrations are now open.');
        """)
    db.commit()
    db.close()

def row_to_dict(row):
    return dict(row) if row else None

def rows_to_list(rows):
    return [dict(r) for r in rows]

def new_id():
    return str(uuid.uuid4())

# ── CORS headers ─────────────────────────────────────────────────────────────

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    return response

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_index(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory('.', 'index.html')

# ── AUTH ─────────────────────────────────────────────────────────────────────

@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS': return '', 204
    data = request.get_json()
    db = get_db()
    row = db.execute("SELECT * FROM admin WHERE id=1").fetchone()
    if row and data.get('username') == row['username'] and data.get('password') == row['password']:
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

# ── EVENTS ───────────────────────────────────────────────────────────────────

@app.route('/api/events', methods=['GET', 'OPTIONS'])
def get_events():
    if request.method == 'OPTIONS': return '', 204
    db = get_db()
    rows = db.execute("SELECT * FROM events ORDER BY date ASC").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d['_id'] = d.pop('id')
        d['participants'] = d.get('participants', 1)
        result.append(d)
    return jsonify(result)

@app.route('/api/events', methods=['POST'])
def create_event():
    data = request.get_json()
    db = get_db()
    eid = new_id()
    db.execute("INSERT INTO events (id,name,date,venue,description,participants) VALUES (?,?,?,?,?,?)",
               (eid, data['name'], data['date'], data['venue'], data.get('description',''), data.get('participants',1)))
    db.commit()
    return jsonify({'_id': eid, **data}), 201

@app.route('/api/events/<eid>', methods=['PUT'])
def update_event(eid):
    data = request.get_json()
    db = get_db()
    db.execute("UPDATE events SET name=?,date=?,venue=?,description=?,participants=? WHERE id=?",
               (data['name'], data['date'], data['venue'], data.get('description',''), data.get('participants',1), eid))
    db.commit()
    return jsonify({'_id': eid, **data})

@app.route('/api/events/<eid>', methods=['DELETE'])
def delete_event(eid):
    db = get_db()
    db.execute("DELETE FROM events WHERE id=?", (eid,))
    db.commit()
    return jsonify({'deleted': True})

# ── SCHEDULES ────────────────────────────────────────────────────────────────

@app.route('/api/schedules', methods=['GET'])
def get_schedules():
    db = get_db()
    rows = db.execute("SELECT * FROM schedules ORDER BY time ASC").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d['_id'] = d.pop('id')
        d['eventName'] = d.pop('event_name')
        result.append(d)
    return jsonify(result)

@app.route('/api/schedules', methods=['POST'])
def create_schedule():
    data = request.get_json()
    db = get_db()
    sid = new_id()
    db.execute("INSERT INTO schedules (id,event_name,time,activity,speaker,venue) VALUES (?,?,?,?,?,?)",
               (sid, data['eventName'], data['time'], data['activity'], data['speaker'], data.get('venue','')))
    db.commit()
    return jsonify({'_id': sid, **data}), 201

@app.route('/api/schedules/<sid>', methods=['PUT'])
def update_schedule(sid):
    data = request.get_json()
    db = get_db()
    db.execute("UPDATE schedules SET event_name=?,time=?,activity=?,speaker=?,venue=? WHERE id=?",
               (data['eventName'], data['time'], data['activity'], data['speaker'], data.get('venue',''), sid))
    db.commit()
    return jsonify({'_id': sid, **data})

@app.route('/api/schedules/<sid>', methods=['DELETE'])
def delete_schedule(sid):
    db = get_db()
    db.execute("DELETE FROM schedules WHERE id=?", (sid,))
    db.commit()
    return jsonify({'deleted': True})

# ── REGISTRATIONS ─────────────────────────────────────────────────────────────

@app.route('/api/registrations', methods=['GET'])
def get_registrations():
    db = get_db()
    rows = db.execute("SELECT * FROM registrations ORDER BY registered_at DESC").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d['_id'] = d.pop('id')
        d['eventName'] = d.pop('event_name')
        d['studentName'] = d.pop('student_name')
        d['collegeName'] = d.pop('college_name')
        d['rollNo'] = d.pop('roll_no')
        d['menuPreference'] = d.pop('menu_preference')
        d['participantCount'] = d.pop('participant_count')
        d['registeredAt'] = d.pop('registered_at')
        d['paymentStatus'] = d.pop('payment_status')
        d['participants'] = json.loads(d.pop('participants_json', '[]'))
        result.append(d)
    return jsonify(result)

@app.route('/api/registrations', methods=['POST'])
def create_registration():
    data = request.get_json()
    db = get_db()
    rid = new_id()
    participants = data.get('participants', [])
    db.execute("""INSERT INTO registrations
        (id,event_name,student_name,college_name,roll_no,email,phone,menu_preference,participant_count,participants_json,payment_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (rid, data['eventName'], data['studentName'], data['collegeName'],
         data.get('rollNo',''), data.get('email',''), data.get('phone',''),
         data.get('menuPreference',''), data.get('participantCount',1),
         json.dumps(participants), 'pending'))
    db.commit()
    return jsonify({'_id': rid, **data}), 201

@app.route('/api/registrations/<rid>', methods=['DELETE'])
def delete_registration(rid):
    db = get_db()
    db.execute("DELETE FROM registrations WHERE id=?", (rid,))
    db.commit()
    return jsonify({'deleted': True})

# ── NOTICES ──────────────────────────────────────────────────────────────────

@app.route('/api/notices', methods=['GET'])
def get_notices():
    db = get_db()
    rows = db.execute("SELECT * FROM notices ORDER BY created_at DESC").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d['_id'] = d.pop('id')
        result.append(d)
    return jsonify(result)

@app.route('/api/notices', methods=['POST'])
def create_notice():
    data = request.get_json()
    db = get_db()
    nid = new_id()
    db.execute("INSERT INTO notices (id,title,description) VALUES (?,?,?)",
               (nid, data['title'], data['description']))
    db.commit()
    return jsonify({'_id': nid, **data}), 201

@app.route('/api/notices/<nid>', methods=['DELETE'])
def delete_notice(nid):
    db = get_db()
    db.execute("DELETE FROM notices WHERE id=?", (nid,))
    db.commit()
    return jsonify({'deleted': True})

# ── FEEDBACKS ─────────────────────────────────────────────────────────────────

@app.route('/api/feedbacks', methods=['GET'])
def get_feedbacks():
    db = get_db()
    rows = db.execute("SELECT * FROM feedbacks ORDER BY submitted_at DESC").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d['_id'] = d.pop('id')
        d['eventName'] = d.pop('event_name')
        d['submittedAt'] = d.pop('submitted_at')
        result.append(d)
    return jsonify(result)

@app.route('/api/feedbacks', methods=['POST'])
def create_feedback():
    data = request.get_json()
    db = get_db()
    fid = new_id()
    db.execute("INSERT INTO feedbacks (id,name,email,event_name,rating,comments) VALUES (?,?,?,?,?,?)",
               (fid, data['name'], data['email'], data.get('eventName','General'), data['rating'], data['comments']))
    db.commit()
    return jsonify({'_id': fid, **data}), 201

@app.route('/api/feedbacks/<fid>', methods=['DELETE'])
def delete_feedback(fid):
    db = get_db()
    db.execute("DELETE FROM feedbacks WHERE id=?", (fid,))
    db.commit()
    return jsonify({'deleted': True})

# ── BROCHURES ─────────────────────────────────────────────────────────────────

@app.route('/api/brochures', methods=['GET'])
def get_brochures():
    db = get_db()
    rows = db.execute("SELECT * FROM brochures ORDER BY uploaded_at DESC").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d['_id'] = d.pop('id')
        d['linkedEvent'] = d.pop('linked_event')
        d['fileName'] = d.pop('file_name')
        d['fileData'] = d.pop('file_data')
        d['fileType'] = d.pop('file_type')
        d['uploadedAt'] = d.pop('uploaded_at')
        result.append(d)
    return jsonify(result)

@app.route('/api/brochures', methods=['POST'])
def create_brochure():
    data = request.get_json()
    db = get_db()
    bid = new_id()
    db.execute("INSERT INTO brochures (id,title,linked_event,description,file_name,file_data,file_type) VALUES (?,?,?,?,?,?,?)",
               (bid, data['title'], data.get('linkedEvent',''), data.get('description',''),
                data.get('fileName',''), data.get('fileData',''), data.get('fileType','')))
    db.commit()
    return jsonify({'_id': bid, **data}), 201

@app.route('/api/brochures/<bid>', methods=['PUT'])
def update_brochure(bid):
    data = request.get_json()
    db = get_db()
    existing = db.execute("SELECT file_data FROM brochures WHERE id=?", (bid,)).fetchone()
    file_data = data.get('fileData') or (existing['file_data'] if existing else '')
    file_name = data.get('fileName') or ''
    file_type = data.get('fileType') or ''
    db.execute("UPDATE brochures SET title=?,linked_event=?,description=?,file_name=?,file_data=?,file_type=? WHERE id=?",
               (data['title'], data.get('linkedEvent',''), data.get('description',''),
                file_name, file_data, file_type, bid))
    db.commit()
    return jsonify({'_id': bid, **data})

@app.route('/api/brochures/<bid>', methods=['DELETE'])
def delete_brochure(bid):
    db = get_db()
    db.execute("DELETE FROM brochures WHERE id=?", (bid,))
    db.commit()
    return jsonify({'deleted': True})

# ── MOMENTS ──────────────────────────────────────────────────────────────────

@app.route('/api/moments', methods=['GET'])
def get_moments():
    db = get_db()
    rows = db.execute("SELECT * FROM moments ORDER BY uploaded_at DESC").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d['_id'] = d.pop('id')
        d['linkedEvent'] = d.pop('linked_event')
        d['fileName'] = d.pop('file_name')
        d['fileData'] = d.pop('file_data')
        d['fileType'] = d.pop('file_type')
        d['uploadedAt'] = d.pop('uploaded_at')
        d['desc'] = d.pop('description')
        result.append(d)
    return jsonify(result)

@app.route('/api/moments', methods=['POST'])
def create_moment():
    data = request.get_json()
    db = get_db()
    mid = new_id()
    db.execute("INSERT INTO moments (id,title,type,linked_event,description,file_name,file_data,file_type) VALUES (?,?,?,?,?,?,?,?)",
               (mid, data['title'], data.get('type','photo'), data.get('linkedEvent',''),
                data.get('desc',''), data.get('fileName',''), data.get('fileData',''), data.get('fileType','')))
    db.commit()
    return jsonify({'_id': mid, **data}), 201

@app.route('/api/moments/<mid>', methods=['PUT'])
def update_moment(mid):
    data = request.get_json()
    db = get_db()
    existing = db.execute("SELECT file_data FROM moments WHERE id=?", (mid,)).fetchone()
    file_data = data.get('fileData') or (existing['file_data'] if existing else '')
    file_name = data.get('fileName') or ''
    file_type = data.get('fileType') or ''
    db.execute("UPDATE moments SET title=?,type=?,linked_event=?,description=?,file_name=?,file_data=?,file_type=? WHERE id=?",
               (data['title'], data.get('type','photo'), data.get('linkedEvent',''),
                data.get('desc',''), file_name, file_data, file_type, mid))
    db.commit()
    return jsonify({'_id': mid, **data})

@app.route('/api/moments/<mid>', methods=['DELETE'])
def delete_moment(mid):
    db = get_db()
    db.execute("DELETE FROM moments WHERE id=?", (mid,))
    db.commit()
    return jsonify({'deleted': True})

# ── CERTIFICATES ──────────────────────────────────────────────────────────────

@app.route('/api/certificates', methods=['GET'])
def get_certificates():
    db = get_db()
    rows = db.execute("SELECT * FROM certificates ORDER BY published_at DESC").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d['_id'] = d.pop('id')
        d['eventId'] = d.pop('event_id')
        d['eventName'] = d.pop('event_name')
        d['eventDate'] = d.pop('event_date')
        d['orgName'] = d.pop('org_name')
        d['sig1Name'] = d.pop('sig1_name')
        d['sig1Title'] = d.pop('sig1_title')
        d['sig2Name'] = d.pop('sig2_name')
        d['sig2Title'] = d.pop('sig2_title')
        d['recipients'] = json.loads(d.pop('recipients_json', '[]'))
        d['publishedAt'] = d.pop('published_at')
        result.append(d)
    return jsonify(result)

@app.route('/api/certificates', methods=['POST'])
def create_certificate():
    data = request.get_json()
    db = get_db()
    cid = new_id()
    db.execute("""INSERT INTO certificates
        (id,event_id,event_name,event_date,type,achievement,org_name,sig1_name,sig1_title,sig2_name,sig2_title,recipients_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (cid, data.get('eventId',''), data['eventName'], data['eventDate'],
         data['type'], data.get('achievement',''), data.get('orgName','Event Management System'),
         data.get('sig1Name',''), data.get('sig1Title',''), data.get('sig2Name',''), data.get('sig2Title',''),
         json.dumps(data.get('recipients',[]))))
    db.commit()
    return jsonify({'_id': cid, **data}), 201

@app.route('/api/certificates/<cid>', methods=['PUT'])
def update_certificate(cid):
    data = request.get_json()
    db = get_db()
    db.execute("""UPDATE certificates SET event_id=?,event_name=?,event_date=?,type=?,achievement=?,
        org_name=?,sig1_name=?,sig1_title=?,sig2_name=?,sig2_title=?,recipients_json=? WHERE id=?""",
        (data.get('eventId',''), data['eventName'], data['eventDate'],
         data['type'], data.get('achievement',''), data.get('orgName','Event Management System'),
         data.get('sig1Name',''), data.get('sig1Title',''), data.get('sig2Name',''), data.get('sig2Title',''),
         json.dumps(data.get('recipients',[])), cid))
    db.commit()
    return jsonify({'_id': cid, **data})

@app.route('/api/certificates/<cid>', methods=['DELETE'])
def delete_certificate(cid):
    db = get_db()
    db.execute("DELETE FROM certificates WHERE id=?", (cid,))
    db.commit()
    return jsonify({'deleted': True})

# ── PAYMENT SETTINGS ─────────────────────────────────────────────────────────

@app.route('/api/payment-settings', methods=['GET'])
def get_payment_settings():
    db = get_db()
    row = db.execute("SELECT * FROM payment_settings WHERE id=1").fetchone()
    if not row:
        return jsonify({})
    d = dict(row)
    return jsonify({
        'qrCode': d['qr_code'],
        'upiId': d['upi_id'],
        'upiName': d['upi_name'],
        'bankName': d['bank_name'],
        'accountNumber': d['account_number'],
        'ifscCode': d['ifsc_code'],
        'accountHolder': d['account_holder']
    })

@app.route('/api/payment-settings', methods=['POST'])
def save_payment_settings():
    data = request.get_json()
    db = get_db()
    db.execute("""INSERT OR REPLACE INTO payment_settings
        (id,qr_code,upi_id,upi_name,bank_name,account_number,ifsc_code,account_holder)
        VALUES (1,?,?,?,?,?,?,?)""",
        (data.get('qrCode',''), data.get('upiId',''), data.get('upiName',''),
         data.get('bankName',''), data.get('accountNumber',''), data.get('ifscCode',''), data.get('accountHolder','')))
    db.commit()
    return jsonify({'success': True})

# ── MAIN ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    print("\n✅ Event Management System is running!")
    print("   Open: http://localhost:5000\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
