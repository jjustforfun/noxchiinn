# Чек-лист отсутствующих аудиозаписей (Этап 7)

**Дата ревизии:** 2026-09-15

## Итог

Финальных аудиофайлов носителя в проекте — **0**. Всего до публичного релиза
нужно **118 записей**: 49 букв алфавита, 68 карточек тематической лексики и
1 отдельная запись слова дня (`word-nana.mp3`). Все поля `audioStatus`
находятся в состоянии `pending`. Пустые/плейсхолдерные MP3 намеренно не
создавались: они вызывали бы ошибку декодирования и вводили бы в заблуждение.

Звуковой режим урока включается только когда готовы **все** карточки темы,
а в свободной тренировке — когда готов комплект темы. Плеер (`src/audio.js`)
не считает один `audioStatus: ready` доказательством права на публикацию:
требуются одновременно `recording.reviewed: true` и `recording.permission`.
TTS/`speechSynthesis` не используется и использоваться не будет — обычный
синтез речи не воспроизводит чеченские абруптивы (пӀ, тӀ, кӀ, хӀ), гортанную
смычку Ӏ и увулярные звуки.

## Что требуется для закрытия аудио-блокера

1. Согласие совершеннолетнего носителя языка на запись и распространение голоса.
2. Согласование с преподавателем чеченского названий букв, произношения,
   темпа и ударений (см. спорные формы в `docs/content-review.md`).
3. Запись каждого `id` отдельным MP3 (96–128 кбит/с, mono), без клиппинга и
   длинных пауз, выровненная громкость.
4. Размещение файла в `public/audio/` по имени из JSON.
5. Проверка лицензии/разрешения и правильности произношения.
6. Только после этого — смена `audioStatus` на `ready` и добавление объекта
   `recording` с `reviewed: true`, кодом разрешения `permission` и `revision`.

Эталонные справочные ресурсы (НЕ утверждение об открытой лицензии — перед
использованием проверьте лицензию конкретного файла): Forvo (раздел ce),
audiolang.info, nohchalla.com, mylittlewordland.com, mir2050.narod.ru.
Подробности — в `docs/audio.md`.

## Полный список путей


### Алфавит (49 записей, статус native-review-needed)

| ID | Чеченский | Русский | Путь аудио | Статус |
| --- | --- | --- | --- | --- |
| a | А | Буква А | /audio/alphabet-a.mp3 | pending |
| ae | Аь | Буква Аь | /audio/alphabet-ae.mp3 | pending |
| b | Б | Буква Б | /audio/alphabet-b.mp3 | pending |
| v | В | Буква В | /audio/alphabet-v.mp3 | pending |
| g | Г | Буква Г | /audio/alphabet-g.mp3 | pending |
| gh | ГӀ | Буква ГӀ | /audio/alphabet-gh.mp3 | pending |
| d | Д | Буква Д | /audio/alphabet-d.mp3 | pending |
| e | Е | Буква Е | /audio/alphabet-e.mp3 | pending |
| yo | Ё | Буква Ё | /audio/alphabet-yo.mp3 | pending |
| zh | Ж | Буква Ж | /audio/alphabet-zh.mp3 | pending |
| z | З | Буква З | /audio/alphabet-z.mp3 | pending |
| i | И | Буква И | /audio/alphabet-i.mp3 | pending |
| y | Й | Буква Й | /audio/alphabet-y.mp3 | pending |
| k | К | Буква К | /audio/alphabet-k.mp3 | pending |
| kh | Кх | Буква Кх | /audio/alphabet-kh.mp3 | pending |
| qq | Къ | Буква Къ | /audio/alphabet-qq.mp3 | pending |
| ke | КӀ | Буква КӀ | /audio/alphabet-ke.mp3 | pending |
| l | Л | Буква Л | /audio/alphabet-l.mp3 | pending |
| m | М | Буква М | /audio/alphabet-m.mp3 | pending |
| n | Н | Буква Н | /audio/alphabet-n.mp3 | pending |
| o | О | Буква О | /audio/alphabet-o.mp3 | pending |
| oe | Оь | Буква Оь | /audio/alphabet-oe.mp3 | pending |
| p | П | Буква П | /audio/alphabet-p.mp3 | pending |
| pe | ПӀ | Буква ПӀ | /audio/alphabet-pe.mp3 | pending |
| r | Р | Буква Р | /audio/alphabet-r.mp3 | pending |
| s | С | Буква С | /audio/alphabet-s.mp3 | pending |
| t | Т | Буква Т | /audio/alphabet-t.mp3 | pending |
| te | ТӀ | Буква ТӀ | /audio/alphabet-te.mp3 | pending |
| u | У | Буква У | /audio/alphabet-u.mp3 | pending |
| ue | Уь | Буква Уь | /audio/alphabet-ue.mp3 | pending |
| f | Ф | Буква Ф | /audio/alphabet-f.mp3 | pending |
| x | Х | Буква Х | /audio/alphabet-x.mp3 | pending |
| xh | Хь | Буква Хь | /audio/alphabet-xh.mp3 | pending |
| h | ХӀ | Буква ХӀ | /audio/alphabet-h.mp3 | pending |
| c | Ц | Буква Ц | /audio/alphabet-c.mp3 | pending |
| ce | ЦӀ | Буква ЦӀ | /audio/alphabet-ce.mp3 | pending |
| ch | Ч | Буква Ч | /audio/alphabet-ch.mp3 | pending |
| che | ЧӀ | Буква ЧӀ | /audio/alphabet-che.mp3 | pending |
| sh | Ш | Буква Ш | /audio/alphabet-sh.mp3 | pending |
| sch | Щ | Буква Щ | /audio/alphabet-sch.mp3 | pending |
| hard | Ъ | Твёрдый знак | /audio/alphabet-hard.mp3 | pending |
| yi | Ы | Буква Ы | /audio/alphabet-yi.mp3 | pending |
| soft | Ь | Мягкий знак | /audio/alphabet-soft.mp3 | pending |
| eh | Э | Буква Э | /audio/alphabet-eh.mp3 | pending |
| yu | Ю | Буква Ю | /audio/alphabet-yu.mp3 | pending |
| yue | Юь | Буква Юь | /audio/alphabet-yue.mp3 | pending |
| ya | Я | Буква Я | /audio/alphabet-ya.mp3 | pending |
| yae | Яь | Буква Яь | /audio/alphabet-yae.mp3 | pending |
| pal | Ӏ | Палочка | /audio/alphabet-pal.mp3 | pending |

### Цифры (20 записей, статус native-review-needed)

| ID | Чеченский | Русский | Путь аудио | Статус |
| --- | --- | --- | --- | --- |
| number-1 | Цхьаъ | Один | /audio/number-1.mp3 | pending |
| number-2 | Шиъ | Два | /audio/number-2.mp3 | pending |
| number-3 | Кхоъ | Три | /audio/number-3.mp3 | pending |
| number-4 | Диъ | Четыре | /audio/number-4.mp3 | pending |
| number-5 | Пхиъ | Пять | /audio/number-5.mp3 | pending |
| number-6 | Ялх | Шесть | /audio/number-6.mp3 | pending |
| number-7 | ВорхӀ | Семь | /audio/number-7.mp3 | pending |
| number-8 | БархӀ | Восемь | /audio/number-8.mp3 | pending |
| number-9 | Исс | Девять | /audio/number-9.mp3 | pending |
| number-10 | Итт | Десять | /audio/number-10.mp3 | pending |
| number-11 | Цхьайтта | Одиннадцать | /audio/number-11.mp3 | pending |
| number-12 | Шийтта | Двенадцать | /audio/number-12.mp3 | pending |
| number-13 | Кхойтта | Тринадцать | /audio/number-13.mp3 | pending |
| number-14 | Дейтта | Четырнадцать | /audio/number-14.mp3 | pending |
| number-15 | Пхийтта | Пятнадцать | /audio/number-15.mp3 | pending |
| number-16 | Ялхитта | Шестнадцать | /audio/number-16.mp3 | pending |
| number-17 | ВуьрхӀитта | Семнадцать | /audio/number-17.mp3 | pending |
| number-18 | БерхӀитта | Восемнадцать | /audio/number-18.mp3 | pending |
| number-19 | Ткъайоьсна | Девятнадцать | /audio/number-19.mp3 | pending |
| number-20 | Ткъа | Двадцать | /audio/number-20.mp3 | pending |

### Цвета (8 записей, статус native-review-needed)

| ID | Чеченский | Русский | Путь аудио | Статус |
| --- | --- | --- | --- | --- |
| color-red | ЦӀен | Красный | /audio/color-red.mp3 | pending |
| color-yellow | Можа | Жёлтый | /audio/color-yellow.mp3 | pending |
| color-green | Баьццара | Зелёный | /audio/color-green.mp3 | pending |
| color-blue | Сийна | Синий | /audio/color-blue.mp3 | pending |
| color-white | КӀайн | Белый | /audio/color-white.mp3 | pending |
| color-black | Ӏаьржа | Чёрный | /audio/color-black.mp3 | pending |
| color-gray | Сира | Серый | /audio/color-gray.mp3 | pending |
| color-brown | Боьмаша | Коричневый | /audio/color-brown.mp3 | pending |

### Первые слова (8 записей, статус native-review-needed)

| ID | Чеченский | Русский | Путь аудио | Статус |
| --- | --- | --- | --- | --- |
| hello | Маршалла хуьлда | Здравствуйте | /audio/hello.mp3 | pending |
| thanks | Баркалла | Спасибо | /audio/thanks.mp3 | pending |
| yes | ХӀаъ | Да | /audio/yes.mp3 | pending |
| bye | Марша Ӏайла | До свидания | /audio/bye.mp3 | pending |
| morning | Ӏуьйре дика хуьлда | Доброе утро | /audio/morning.mp3 | pending |
| day-good | Де дика хуьлда | Добрый день | /audio/day-good.mp3 | pending |
| sorry | Бехк ма билла | Извините | /audio/sorry.mp3 | pending |
| wait | Собар де | Подождите | /audio/wait.mp3 | pending |

### Семья (8 записей, статус native-review-needed)

| ID | Чеченский | Русский | Путь аудио | Статус |
| --- | --- | --- | --- | --- |
| family-mother | Нана | Мама | /audio/family-mother.mp3 | pending |
| family-father | Да | Папа | /audio/family-father.mp3 | pending |
| family-brother | Ваша | Брат | /audio/family-brother.mp3 | pending |
| family-sister | Йиша | Сестра | /audio/family-sister.mp3 | pending |
| family-son | КӀант | Сын | /audio/family-son.mp3 | pending |
| family-daughter | ЙоӀ | Дочь | /audio/family-daughter.mp3 | pending |
| family-grandfather | Ден да | Дедушка по папе | /audio/family-grandfather.mp3 | pending |
| family-grandmother | Ден нана | Бабушка по папе | /audio/family-grandmother.mp3 | pending |

### Еда (8 записей, статус native-review-needed)

| ID | Чеченский | Русский | Путь аудио | Статус |
| --- | --- | --- | --- | --- |
| food-bread | Бепиг | Хлеб | /audio/food-bread.mp3 | pending |
| food-water | Хи | Вода | /audio/food-water.mp3 | pending |
| food-milk | Шура | Молоко | /audio/food-milk.mp3 | pending |
| food-salt | Туьха | Соль | /audio/food-salt.mp3 | pending |
| food-apple | Ӏаж | Яблоко | /audio/food-apple.mp3 | pending |
| food-pear | Кхор | Груша | /audio/food-pear.mp3 | pending |
| food-meat | Жижиг | Мясо | /audio/food-meat.mp3 | pending |
| food-tea | Чай | Чай | /audio/food-tea.mp3 | pending |

### Животные (8 записей, статус native-review-needed)

| ID | Чеченский | Русский | Путь аудио | Статус |
| --- | --- | --- | --- | --- |
| animal-cat | Цициг | Кошка | /audio/animal-cat.mp3 | pending |
| animal-dog | ЖӀаьла | Собака | /audio/animal-dog.mp3 | pending |
| animal-horse | Говр | Лошадь | /audio/animal-horse.mp3 | pending |
| animal-cow | Етт | Корова | /audio/animal-cow.mp3 | pending |
| animal-wolf | Борз | Волк | /audio/animal-wolf.mp3 | pending |
| animal-fox | Цхьогал | Лиса | /audio/animal-fox.mp3 | pending |
| animal-bear | Ча | Медведь | /audio/animal-bear.mp3 | pending |
| animal-hare | Пхьагал | Заяц | /audio/animal-hare.mp3 | pending |

### Тело (8 записей, статус native-review-needed)

| ID | Чеченский | Русский | Путь аудио | Статус |
| --- | --- | --- | --- | --- |
| body-head | Корта | Голова | /audio/body-head.mp3 | pending |
| body-eye | БӀаьрг | Глаз | /audio/body-eye.mp3 | pending |
| body-ear | Лерг | Ухо | /audio/body-ear.mp3 | pending |
| body-nose | Мара | Нос | /audio/body-nose.mp3 | pending |
| body-hand | Куьг | Рука | /audio/body-hand.mp3 | pending |
| body-leg | Ког | Нога | /audio/body-leg.mp3 | pending |
| body-tooth | Церг | Зуб | /audio/body-tooth.mp3 | pending |
| body-neck | Ворта | Шея | /audio/body-neck.mp3 | pending |

### Слово дня (1 запись)

| ID | Чеченский | Русский | Путь аудио | Статус |
| --- | --- | --- | --- | --- |
| word-nana | Нана | мама | /audio/word-nana.mp3 | pending |
