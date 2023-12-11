((
  db = sqlite('pipy.db')
) => (

  db.exec(
    `SELECT * FROM sqlite_schema WHERE type = 'table' AND name = 'pipy'`
  ).length === 0 && (
    db.exec(`
      CREATE TABLE pipy (
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

    insert_pipy: (scheme, client_ip, host, url, user_agent) => (
      db.sql(
        `INSERT INTO pipy (scheme, client_ip, host, url, user_agent) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(1, scheme)
      .bind(2, client_ip)
      .bind(3, host)
      .bind(4, url)
      .bind(5, user_agent)
      .exec(),
      db.sql(
        `SELECT * FROM pipy WHERE id = last_insert_rowid()`
      )
      .exec()[0]
    ),

    update_response_time: (id, response_time, response_code) => (
      db.sql(
        `UPDATE pipy SET response_time = ?, response_code = ? WHERE id = ?`
      )
      .bind(1, response_time)
      .bind(2, response_code)
      .bind(3, id)
      .exec(),
      db.sql(
        `SELECT * FROM pipy WHERE id = ${id}`
      )
      .exec()[0]
    ),

  }

))()