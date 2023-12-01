((
  db = sqlite('access_log.db')
) => (

  db.exec(
    `SELECT * FROM sqlite_schema WHERE type = 'table' AND name = 'access_log'`
  ).length === 0 && (
    db.exec(`
      CREATE TABLE access_log (
        id INTEGER PRIMARY KEY,
        scheme TEXT NOT NULL,
        access_time TEXT NOT NULL,
        access_duration INTEGER NOT NULL DEFAULT 0,
        host TEXT NOT NULL,
        url TEXT NOT NULL,
        user_agent TEXT
      )
    `)
  ),

  {
    list_access_log: () => (
      db.sql(
        `SELECT * FROM access_log order by id desc limit 100`
      )
      .exec()
    ),

    get_access_log: (id) => (
      db.sql(
        `SELECT * FROM access_log WHERE id = ${id}`
      )
      .exec()[0]
    ),

    update_access_duration: (id, access_duration) => (
      db.sql(
        `UPDATE access_log SET access_duration = ? WHERE id = ?`
      )
      .bind(1, access_duration)
      .bind(2, id)
      .exec(),
      db.sql(
        `SELECT * FROM access_log WHERE id = ${id}`
      )
      .exec()[0]
    ),

    insert_access_log: (scheme, access_time, access_duration, host, url, user_agent) => (
      db.sql(
        `INSERT INTO access_log (scheme, access_time, access_duration, host, url, user_agent) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(1, scheme)
      .bind(2, access_time)
      .bind(3, access_duration)
      .bind(4, host)
      .bind(5, url)
      .bind(6, user_agent)
      .exec(),
      db.sql(
        `SELECT * FROM access_log WHERE id = last_insert_rowid()`
      )
      .exec()[0]
    ),

  }

))()