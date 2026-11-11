# Iron Level

Фитнес-RPG для айфона: персонаж растёт вместе с твоими рабочими весами.

## Запуск

Дважды кликни по `index.html`: приложение откроется в браузере. Сборка и зависимости не нужны.

Если нужен локальный сервер (например, чтобы проверить офлайн-режим), в Терминале на Mac:

```bash
cd ~/Desktop/ironlevelmac/iron-level-repo
python3 -m http.server 8000
```

Затем открой `http://localhost:8000`.

## Работа с Claude Code

```bash
cd ~/Desktop/ironlevelmac/iron-level-repo
claude
```

Контекст проекта, правила расчёта XP и правила дизайна лежат в `CLAUDE.md`. Claude Code читает этот файл сам. Требования к продукту — в `docs/PRD.md`.
