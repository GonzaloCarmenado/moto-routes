const s=`
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    captured_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
  );
`;function a(i){return{id:i.id,routeId:i.route_id,filePath:i.file_path,latitude:i.latitude??null,longitude:i.longitude??null,capturedAt:i.captured_at,createdAt:i.created_at,remotePhotoId:i.remote_photo_id??null}}class n{constructor(t){this.db=t}initPromise=null;ensureSchema(){return this.initPromise||(this.initPromise=this.runMigrations()),this.initPromise}async runMigrations(){await this.db.execute("PRAGMA foreign_keys = ON;");const t=s.split(";").filter(e=>e.trim().length>0);for(const e of t)await this.db.execute(e);await this.ensureRemotePhotoIdColumn()}async ensureRemotePhotoIdColumn(){(await this.db.select("PRAGMA table_info(photos);")).some(o=>o.name==="remote_photo_id")||await this.db.execute("ALTER TABLE photos ADD COLUMN remote_photo_id TEXT;")}async add(t){await this.ensureSchema();const e=crypto.randomUUID(),o=new Date().toISOString();return await this.db.execute(`INSERT INTO photos (id, route_id, file_path, latitude, longitude, captured_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,[e,t.routeId,t.filePath,t.latitude,t.longitude,t.capturedAt,o]),{id:e,createdAt:o,remotePhotoId:null,...t}}async getById(t){await this.ensureSchema();const e=await this.db.select("SELECT * FROM photos WHERE id = ?",[t]);return e.length===0?null:a(e[0])}async getByRouteId(t){return await this.ensureSchema(),(await this.db.select("SELECT * FROM photos WHERE route_id = ? ORDER BY captured_at DESC",[t])).map(o=>a(o))}async delete(t){await this.ensureSchema(),await this.db.execute("DELETE FROM photos WHERE id = ?",[t])}async countByRouteId(t){await this.ensureSchema();const e=await this.db.select("SELECT COUNT(*) as count FROM photos WHERE route_id = ?",[t]);return Number(e[0]?.count??0)}async markPhotoSynced(t,e){await this.ensureSchema(),await this.db.execute("UPDATE photos SET remote_photo_id = ? WHERE id = ?",[e,t])}}export{n as SqlitePhotoRepository};
