"""
Сделать пользователя администратором (или снять права).

Использование:
    python server/scripts/make_admin.py kseonyt@gmail.com
    python server/scripts/make_admin.py kseonyt@gmail.com --revoke
    python server/scripts/make_admin.py --list

Работает только с SQLite (server/data.db). Для Postgres используйте psql.
"""
import argparse
import os
import sqlite3
import sys


def db_path() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(here, "..", "data.db"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("email", nargs="?", help="email пользователя")
    ap.add_argument("--revoke", action="store_true", help="снять админ-права")
    ap.add_argument("--list", action="store_true", help="показать всех пользователей")
    args = ap.parse_args()

    path = db_path()
    if not os.path.exists(path):
        print(f"БД не найдена: {path}\nЗапустите сервер хотя бы раз, чтобы он создал её.")
        sys.exit(1)

    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row

    if args.list:
        rows = con.execute("SELECT email, is_admin, created_at FROM users ORDER BY created_at").fetchall()
        if not rows:
            print("Нет пользователей.")
        else:
            print(f"{'admin':<6}  {'email':<40}  created_at")
            print("-" * 80)
            for r in rows:
                mark = "  ✓  " if r["is_admin"] else "     "
                print(f"{mark} {r['email']:<40}  {r['created_at']}")
        return

    if not args.email:
        ap.print_help()
        sys.exit(1)

    target = 0 if args.revoke else 1
    cur = con.execute(
        "UPDATE users SET is_admin = ? WHERE email = ?",
        (target, args.email),
    )
    con.commit()
    if cur.rowcount == 0:
        print(f"Пользователь {args.email} не найден.")
        sys.exit(1)
    print(
        f"✓ {args.email} {'снят с админа' if args.revoke else 'теперь админ'}"
        f" (обновлено строк: {cur.rowcount})"
    )


if __name__ == "__main__":
    main()
