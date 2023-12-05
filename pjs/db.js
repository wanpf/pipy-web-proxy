((
  db = sqlite('access_log.db')
) => (

  db.exec(
    `SELECT * FROM sqlite_schema WHERE type = 'table' AND name = 'access_log'`
  ).length === 0 && (
    db.exec(`
      CREATE TABLE access_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        scheme TEXT NOT NULL,
        request_time TIMESTAMP DEFAULT (datetime('now','localtime')),
        response_time INTEGER NOT NULL DEFAULT 0,
        response_code INTEGER NOT NULL DEFAULT 0,
        client_ip VARCHAR(40),
        host TEXT NOT NULL,
        url TEXT NOT NULL,
        user_agent TEXT
      )
    `)
  ),

  {

    insert_access_log: (scheme, client_ip, host, url, user_agent) => (
      db.sql(
        `INSERT INTO access_log (scheme, client_ip, host, url, user_agent) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(1, scheme)
      .bind(2, client_ip)
      .bind(3, host)
      .bind(4, url)
      .bind(5, user_agent)
      .exec(),
      db.sql(
        `SELECT * FROM access_log WHERE id = last_insert_rowid()`
      )
      .exec()[0]
    ),

    update_response_time: (id, response_time, response_code) => (
      db.sql(
        `UPDATE access_log SET response_time = ?, response_code = ? WHERE id = ?`
      )
      .bind(1, response_time)
      .bind(2, response_code)
      .bind(3, id)
      .exec(),
      db.sql(
        `SELECT * FROM access_log WHERE id = ${id}`
      )
      .exec()[0]
    ),

  }

))()