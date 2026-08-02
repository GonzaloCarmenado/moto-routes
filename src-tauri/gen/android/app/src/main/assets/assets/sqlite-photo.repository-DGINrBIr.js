const d=`
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
`;function s(i){return{id:i.id,routeId:i.route_id,filePath:i.file_path,latitude:i.latitude??null,longitude:i.longitude??null,capturedAt:i.captured_at,createdAt:i.created_at}}class u{constructor(t){this.db=t}initialized=!1;async ensureSchema(){if(this.initialized)return;await this.db.execute("PRAGMA foreign_keys = ON;");const t=d.split(";").filter(e=>e.trim().length>0);for(const e of t)await this.db.execute(e);this.initialized=!0}async add(t){await this.ensureSchema();const e=crypto.randomUUID(),a=new Date().toISOString();return await this.db.execute(`INSERT INTO photos (id, route_id, file_path, latitude, longitude, captured_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,[e,t.routeId,t.filePath,t.latitude,t.longitude,t.capturedAt,a]),{id:e,createdAt:a,...t}}async getById(t){await this.ensureSchema();const e=await this.db.select("SELECT * FROM photos WHERE id = ?",[t]);return e.length===0?null:s(e[0])}async getByRouteId(t){return await this.ensureSchema(),(await this.db.select("SELECT * FROM photos WHERE route_id = ? ORDER BY captured_at DESC",[t])).map(a=>s(a))}async delete(t){await this.ensureSchema(),await this.db.execute("DELETE FROM photos WHERE id = ?",[t])}async countByRouteId(t){await this.ensureSchema();const e=await this.db.select("SELECT COUNT(*) as count FROM photos WHERE route_id = ?",[t]);return Number(e[0]?.count??0)}}export{u as SqlitePhotoRepository};
//# sourceMappingURL=sqlite-photo.repository-DGINrBIr.js.map
