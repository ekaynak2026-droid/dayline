// Languages: English and Russian.
// Texts are written in English in the code and wrapped in t('…'). For Russian, t() looks the English
// text up in RU below; anything not listed stays in English. {name} marks a value filled in by the app.
// The choice is kept on each device (Settings → Language); a phone set to Russian starts in Russian.

export type Lang = 'en' | 'ru';
const KEY = 'dayline-lang';

function detect(): Lang {
  if (typeof window === 'undefined') return 'en';
  try { const v = localStorage.getItem(KEY); if (v === 'en' || v === 'ru') return v; } catch { /* private mode */ }
  return /^ru\b/i.test(navigator.language || '') ? 'ru' : 'en';
}
let lang: Lang = detect();
// Tell the browser which language the page is in, so it doesn't offer to machine-translate it.
if (typeof document !== 'undefined') document.documentElement.lang = lang;
export const getLang = () => lang;
/** Changes the language. The caller redraws the screen. */
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* private mode */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}
/** For dates: "30 October" / "30 октября". */
export const locale = () => (lang === 'ru' ? 'ru-RU' : 'en-GB');

/** Russian number endings: 1 заметка, 2 заметки, 5 заметок. */
function ruForm(n: number, forms: string[]) {
  const a = Math.abs(n) % 100, b = a % 10;
  return forms[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2];
}

export function t(en: string, vars?: Record<string, string | number>) {
  const v = lang === 'ru' ? RU[en] : undefined;
  let s = v === undefined ? en : Array.isArray(v) ? ruForm(Number(vars?.n ?? 0), v) : v;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}
/** Short weekday names, Monday first. */
export const weekdays = () => (lang === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

const RU: Record<string, string | string[]> = {
  // tabs and common buttons
  'Tasks': 'Задачи', 'Calendar': 'Календарь', 'Notes': 'Заметки', 'Settings': 'Настройки',
  'Today': 'Сегодня', 'Tomorrow': 'Завтра', 'Yesterday': 'Вчера',
  'Add task': 'Добавить задачу', 'Add event': 'Добавить событие', 'New note': 'Новая заметка',
  'Save': 'Сохранить', 'Cancel': 'Отмена', 'Delete': 'Удалить', 'Done': 'Готово', 'Close': 'Закрыть', 'Download': 'Скачать',
  'Could not save. Your phone may be out of space.': 'Не удалось сохранить. Возможно, на телефоне мало места.',
  'Copied your tasks and notes from Dayline': 'Задачи и заметки скопированы из Dayline',
  'Copied from Dayline': 'Скопировано из Dayline',
  'Language': 'Язык',

  // reminders
  'No reminder': 'Без напоминания', 'At the time': 'В назначенное время', '10 minutes before': 'За 10 минут',
  '1 hour before': 'За 1 час', '1 day before': 'За 1 день', 'Reminder': 'Напоминание',
  'Reminder: {title}': 'Напоминание: {title}', '{day} at {time}': '{day} в {time}',
  'Add Dayline to your Home Screen first': 'Сначала добавьте Dayline на экран «Домой»',
  'This browser cannot show reminders': 'Этот браузер не может показывать напоминания',
  'Reminders are on': 'Напоминания включены',
  'Reminders are blocked. You can allow them in your phone settings.': 'Напоминания заблокированы. Их можно разрешить в настройках телефона.',
  'Turn on reminders in Settings to get alerts': 'Включите напоминания в настройках, чтобы получать оповещения',

  // files
  'Photo': 'Фото', 'File': 'Файл', 'Slides': 'Слайды',
  'This file has not reached this device yet. Try again in a moment.': 'Этот файл ещё не загрузился на это устройство. Попробуйте чуть позже.',
  'Connect to the internet to open this file on this device': 'Подключитесь к интернету, чтобы открыть этот файл на этом устройстве',
  'This file is not on this device yet': 'Этого файла пока нет на этом устройстве',
  '{name} is bigger than 10 MB': '{name} больше 10 МБ',
  'Preview {name}': 'Просмотр: {name}', 'Download {name}': 'Скачать: {name}', 'Remove {name}': 'Удалить: {name}',
  '📂 Files and photos': '📂 Файлы и фото', 'Files and photos': 'Файлы и фото', '📂 Files': '📂 Файлы',
  'No files yet': 'Файлов пока нет', 'Attach file or photo': 'Прикрепить файл или фото',
  'Files and photos ({n})': 'Файлы и фото ({n})', 'Files saved': 'Файлы сохранены',

  // tasks and events
  'Mark as done': 'Отметить как выполненное', 'Mark as not done': 'Снять отметку', 'All day': 'Весь день',
  'Task added': 'Задача добавлена', 'Task saved': 'Задача сохранена', 'Task deleted': 'Задача удалена',
  'New task': 'Новая задача', 'Edit task': 'Изменить задачу', 'Task': 'Задача', 'What do you need to do?': 'Что нужно сделать?',
  'Day': 'День', 'Time (optional)': 'Время (необязательно)',
  'Event pinned': 'Событие добавлено в календарь', 'Event saved': 'Событие сохранено', 'Event deleted': 'Событие удалено',
  'Give the event a name first': 'Сначала дайте событию название',
  'New event': 'Новое событие', 'Edit event': 'Изменить событие', 'Event': 'Событие',
  'e.g. Dentist, Birthday, Flight': 'например: Стоматолог, День рождения, Рейс',
  'Date': 'Дата', 'Time (empty = all day)': 'Время (пусто — весь день)', 'Colour': 'Цвет', 'Colour {n}': 'Цвет {n}',
  "Also add to my phone's calendar": 'Добавить также в календарь телефона',
  'Moved to today': 'Перенесено на сегодня', 'You can find this again in Settings': 'Это можно найти в настройках',
  'Not now': 'Не сейчас', 'Install': 'Установить',
  'Put Dayline on your home screen': 'Добавьте Dayline на главный экран',
  'so it opens like a normal app and works without internet.': 'чтобы оно открывалось как обычное приложение и работало без интернета.',
  'Open this page in Safari.': 'Откройте эту страницу в Safari.',
  'Tap the Share button (the square with an arrow pointing up).': 'Нажмите кнопку «Поделиться» (квадрат со стрелкой вверх).',
  'Scroll down and tap Add to Home Screen, then Add.': 'Прокрутите вниз и нажмите «На экран „Домой“», затем «Добавить».',
  'Tap the button to add Dayline to your home screen.': 'Нажмите кнопку, чтобы добавить Dayline на главный экран.',
  'Open this page in Chrome.': 'Откройте эту страницу в Chrome.',
  'Tap the ⋮ menu at the top right.': 'Нажмите меню ⋮ в правом верхнем углу.',
  'Tap Install app or Add to Home screen.': 'Нажмите «Установить приложение» или «Добавить на главный экран».',
  '{n} unfinished from earlier days': ['{n} невыполненная задача с прошлых дней', '{n} невыполненные задачи с прошлых дней', '{n} невыполненных задач с прошлых дней'], 'Move to today': 'Перенести на сегодня',
  'Type below to add your first task. Tap + to give it a time or a reminder.': 'Напишите ниже свою первую задачу. Нажмите +, чтобы указать время или напоминание.',
  'Add a task for {name}': 'Добавить задачу на {name}', 'Add a task for today': 'Добавить задачу на сегодня', 'Add a task': 'Добавить задачу',

  // calendar
  'Previous month': 'Предыдущий месяц', 'Next month': 'Следующий месяц', 'Today, ': 'Сегодня, ',
  '{date}, {n} pinned': ['{date}, {n} запись', '{date}, {n} записи', '{date}, {n} записей'], '+{n} more': 'ещё {n}', 'Nothing pinned on this day yet.': 'На этот день пока ничего не запланировано.',
  '+ Add event': '+ Добавить событие', 'Back to today': 'Вернуться к сегодня',
  'Open this day in Tasks': 'Открыть этот день в задачах', 'See 1 more task without a time': 'Показать ещё 1 задачу без времени', 'See {n} more tasks without a time': ['Показать ещё {n} задачу без времени', 'Показать ещё {n} задачи без времени', 'Показать ещё {n} задач без времени'],

  // notes
  'All': 'Все', 'Checklists': 'Списки', 'With photos': 'С фото', 'With files': 'С файлами',
  'Untitled': 'Без названия', '{left} of {n} left': 'Осталось {left} из {n}', '{n} files': ['{n} файл', '{n} файла', '{n} файлов'],
  'No photo notes yet. Tap + and choose "Photo note".': 'Заметок с фото пока нет. Нажмите + и выберите «Заметка с фото».',
  'No files yet. Open a note or checklist and attach a file.': 'Файлов пока нет. Откройте заметку или список и прикрепите файл.',
  'No checklists yet. Tap + and choose "Checklist".': 'Списков пока нет. Нажмите + и выберите «Список».',
  'No notes yet. Tap + to write one, like a shopping list.': 'Заметок пока нет. Нажмите +, чтобы написать, например, список покупок.',
  'Locked notes': 'Защищённые заметки', 'Lock now': 'Заблокировать сейчас', 'Locked': 'Заблокировано',
  'No locked notes yet. Tap + and choose "Locked note".': 'Защищённых заметок пока нет. Нажмите + и выберите «Защищённая заметка».',
  '1 locked note': '1 защищённая заметка', '{n} locked notes': ['{n} защищённая заметка', '{n} защищённые заметки', '{n} защищённых заметок'],
  'Set up locked notes': 'Настроить защищённые заметки', 'Tap and enter your PIN to open': 'Нажмите и введите PIN, чтобы открыть',
  'For passwords, codes and other private things. Choose a 6-digit PIN.': 'Для паролей, кодов и других личных данных. Выберите 6-значный PIN.',
  'Locked notes are encrypted on this phone with your PIN. Nobody, including me, can open them without it, so keep your PIN somewhere safe. They lock again a minute after you leave the app.':
    'Защищённые заметки шифруются на этом телефоне вашим PIN-кодом. Без него их никто не сможет открыть, поэтому храните PIN в надёжном месте. Они снова блокируются через минуту после выхода из приложения.',
  'Text note': 'Текстовая заметка', 'Anything to remember for later': 'Всё, что нужно запомнить',
  'Checklist': 'Список', 'Shopping lists, packing lists, things to buy': 'Списки покупок, вещей в дорогу, дел',
  'Photo note': 'Заметка с фото', 'A picture with a few words, like a parking spot or a receipt': 'Снимок с подписью, например место парковки или чек',
  'Locked note': 'Защищённая заметка', 'Passwords and codes, encrypted with your PIN': 'Пароли и коды, зашифрованные вашим PIN-кодом',
  'New checklist': 'Новый список', 'New photo note': 'Новая заметка с фото', 'New locked note': 'Новая защищённая заметка', 'Edit note': 'Изменить заметку',
  'Title': 'Название', 'e.g. Shopping list': 'например: Список покупок', 'e.g. Bank app login': 'например: Вход в банк', 'e.g. Where I parked': 'например: Где припаркована машина',
  'Items': 'Пункты', 'Item': 'Пункт списка', 'Remove item': 'Удалить пункт', '+ Add item': '+ Добавить пункт',
  'Note': 'Заметка', 'Write anything…': 'Напишите что угодно…', 'Attached photo': 'Прикреплённое фото',
  'Change photo': 'Сменить фото', 'Attach a photo': 'Прикрепить фото', 'Remove photo': 'Убрать фото',
  'Keep in locked notes (encrypted, needs your PIN)': 'Хранить в защищённых заметках (шифруется, нужен PIN)',
  'That file is not a photo Dayline can read': 'Этот файл не похож на фото, которое можно открыть',
  'Notes with files cannot be locked yet. Remove the files first.': 'Заметки с файлами пока нельзя защитить. Сначала уберите файлы.',
  'Write something first': 'Сначала что-нибудь напишите', 'Saved and locked': 'Сохранено и защищено',
  'Note saved': 'Заметка сохранена', 'Could not save the note': 'Не удалось сохранить заметку', 'Note deleted': 'Заметка удалена',

  // PIN
  'Choose a new 6-digit PIN': 'Выберите новый 6-значный PIN', 'Choose a 6-digit PIN': 'Выберите 6-значный PIN', 'Enter your PIN': 'Введите PIN',
  'You will type it to open locked notes. If you forget it, those notes cannot be recovered.': 'Он нужен, чтобы открывать защищённые заметки. Если вы его забудете, восстановить их будет невозможно.',
  'Locked notes stay encrypted until you enter it.': 'Защищённые заметки остаются зашифрованными, пока вы его не введёте.',
  'Type it once more': 'Введите ещё раз', 'Just to be sure it is right.': 'Чтобы убедиться, что всё верно.',
  'Those did not match. Start again.': 'Не совпадает. Начните заново.', 'Securing your notes…': 'Шифруем заметки…', 'Checking…': 'Проверяем…',
  'PIN changed': 'PIN изменён', 'PIN set. Locked notes are ready': 'PIN установлен. Защищённые заметки готовы',
  'Wrong PIN. Try again.': 'Неверный PIN. Попробуйте ещё раз.',
  'Locked notes need a secure (https) connection.': 'Для защищённых заметок нужно защищённое (https) соединение.',
  'Delete digit': 'Стереть цифру', '{n} of 6 digits': '{n} из 6 цифр',

  // sync
  'Sync is not set up for this copy of Dayline yet.': 'Синхронизация для этой копии Dayline пока не настроена.',
  'Connecting…': 'Подключение…', 'Sync needs the internet the first time. Try again when you are online.': 'Для первой синхронизации нужен интернет. Попробуйте, когда будете онлайн.',
  'Syncing as {email}.': 'Синхронизация: {email}.', 'Last synced {ago}.': 'Последняя синхронизация: {ago}.', 'Up to date.': 'Всё актуально.',
  'Getting your data…': 'Загружаем ваши данные…',
  'Sign in with the same email on your other devices to share everything.': 'Войдите с тем же email на других устройствах, чтобы всё совпадало.',
  'Sign out on this device': 'Выйти на этом устройстве', 'Signed out. Your data stays on this device.': 'Вы вышли. Данные остаются на этом устройстве.',
  'Use the same email and password on your phone and computer, and everything stays the same on both.': 'Используйте один и тот же email и пароль на телефоне и компьютере — и всё будет одинаково на обоих.',
  'Email': 'Email', 'Password': 'Пароль', 'Sign in': 'Войти', 'Create account': 'Создать аккаунт', 'Forgot password': 'Забыли пароль?',
  'Account created. Syncing…': 'Аккаунт создан. Синхронизация…', 'Password reset email sent': 'Письмо для сброса пароля отправлено',
  'just now': 'только что', '{n} min ago': '{n} мин. назад',
  'That email and password do not match.': 'Email и пароль не совпадают.',
  'There is no account with that email yet. Tap "Create account".': 'Аккаунта с таким email пока нет. Нажмите «Создать аккаунт».',
  'An account with that email already exists. Tap "Sign in" instead.': 'Аккаунт с таким email уже есть. Нажмите «Войти».',
  'Choose a password with at least 6 characters.': 'Пароль должен быть не короче 6 символов.',
  'That email address does not look right.': 'Похоже, email указан неверно.',
  'No internet connection. Try again when you are online.': 'Нет подключения к интернету. Попробуйте позже.',
  'Too many tries. Wait a few minutes and try again.': 'Слишком много попыток. Подождите несколько минут.',
  'Email sign-in is not switched on yet (step 3 of the setup guide).': 'Вход по email ещё не включён (шаг 3 инструкции по настройке).',
  'Type your email first.': 'Сначала введите email.',
  'The online database refused the change. Check the security rules from the setup guide.': 'Онлайн-база отклонила изменение. Проверьте правила безопасности из инструкции.',
  'You are signed in, but the online database refused access. Publish the security rule from step 4 of the setup guide; Dayline tries again every 30 seconds.':
    'Вы вошли, но онлайн-база отказала в доступе. Опубликуйте правило безопасности из шага 4 инструкции; Dayline повторяет попытку каждые 30 секунд.',
  'Sync paused: {msg}. Trying again shortly.': 'Синхронизация приостановлена: {msg}. Скоро попробуем снова.',
  'Could not upload: {msg}': 'Не удалось загрузить: {msg}', 'Could not upload {name}: {msg}': 'Не удалось загрузить {name}: {msg}',

  // settings
  'Reminders': 'Напоминания', 'Reminders are on.': 'Напоминания включены.', 'Reminders are blocked.': 'Напоминания заблокированы.',
  'Allow notifications for Dayline in your phone settings.': 'Разрешите уведомления для Dayline в настройках телефона.',
  'On iPhone, add Dayline to your Home Screen first, then turn reminders on here.': 'На iPhone сначала добавьте Dayline на экран «Домой», затем включите напоминания здесь.',
  'This browser cannot show reminders.': 'Этот браузер не может показывать напоминания.', 'Reminders are off.': 'Напоминания выключены.',
  'Reminders pop up when Dayline is open or running in the background. For events you must not miss, use "Also add to my phone\'s calendar" on the event.':
    'Напоминания появляются, когда Dayline открыт или работает в фоне. Для важных событий используйте «Добавить также в календарь телефона».',
  'Turn on reminders': 'Включить напоминания', 'Sync between devices': 'Синхронизация между устройствами', 'Backup': 'Резервная копия',
  'Your data is also kept in your sync account.': 'Ваши данные также хранятся в аккаунте синхронизации.',
  'Everything is stored only on this device.': 'Всё хранится только на этом устройстве.',
  'Save a backup file now and then, for example to iCloud Drive or Google Drive.': 'Время от времени сохраняйте резервную копию, например в iCloud Drive или Google Drive.',
  'Last backup: {ago}.': 'Последняя копия: {ago}.', 'You have not made a backup yet.': 'Вы ещё не делали резервную копию.',
  'Save a backup file': 'Сохранить резервную копию', 'Includes attached files. Locked notes stay encrypted inside it': 'Включает прикреплённые файлы. Защищённые заметки остаются зашифрованными',
  'Restore from a backup file': 'Восстановить из резервной копии', 'Replaces what is on this phone': 'Заменяет данные на этом телефоне',
  'Change my PIN': 'Изменить PIN', 'You will need your current PIN first': 'Сначала понадобится текущий PIN', 'I forgot my PIN': 'Я забыл PIN',
  'Not set up yet. Open the Notes tab to start.': 'Ещё не настроено. Откройте вкладку «Заметки».', 'Install Dayline': 'Установить Dayline',
  'Preparing backup…': 'Готовим резервную копию…', 'Backup file saved': 'Резервная копия сохранена',
  'Backup saved, but {n} file(s) were not on this device': ['Копия сохранена, но {n} файла нет на этом устройстве', 'Копия сохранена, но {n} файлов нет на этом устройстве', 'Копия сохранена, но {n} файлов нет на этом устройстве'],
  'That is not a Dayline backup file': 'Это не резервная копия Dayline', 'Restore this backup?': 'Восстановить эту копию?',
  'This replaces all tasks, events and notes on this phone with the backup{from}: {t} tasks, {e} events, {n} notes.':
    'Все задачи, события и заметки на этом телефоне будут заменены копией{from}: задач — {t}, событий — {e}, заметок — {n}.',
  ' from {date}': ' от {date}', 'Restore': 'Восстановить', 'Backup restored': 'Копия восстановлена',
  'Forgot your PIN?': 'Забыли PIN?',
  'Locked notes are encrypted with your PIN, so without it they cannot be opened by anyone. If you restore an older backup, use the PIN you had then. The only other option is to delete the {n} locked notes and choose a new PIN.':
    'Защищённые заметки зашифрованы вашим PIN-кодом, поэтому без него их никто не сможет открыть. Если вы восстанавливаете старую копию, используйте PIN, который был тогда. Иначе остаётся только удалить защищённые заметки ({n}) и выбрать новый PIN.',
  'Keep them': 'Оставить', 'Delete locked notes': 'Удалить защищённые заметки', 'Locked notes deleted': 'Защищённые заметки удалены',

  // viewer
  'Opening…': 'Открываем…', '1 page': '1 страница', '{n} pages': ['{n} страница', '{n} страницы', '{n} страниц'], 'This document is empty.': 'Документ пуст.',
  "This kind of file ({ext}) can't be shown inside Dayline.": 'Файлы такого типа ({ext}) нельзя показать в Dayline.',
  'Older Word files (.doc) need Word; files saved as .docx open here.': 'Старые файлы Word (.doc) открываются только в Word; файлы .docx открываются здесь.',
  'Tap Download to open it in another app.': 'Нажмите «Скачать», чтобы открыть его в другом приложении.',
  'The viewer could not load. Connect to the internet once and try again.': 'Просмотр не загрузился. Подключитесь к интернету и попробуйте снова.',
  'Dayline could not read this file. It may be damaged or password-protected.': 'Не удалось прочитать файл. Возможно, он повреждён или защищён паролем.',
  'You can still tap Download.': 'Вы всё равно можете нажать «Скачать».',
  // helper tab: sketch pad
  'Helper': 'Помощник', 'Sketch pad': 'Блокнот для эскизов', 'Sketch': 'Эскиз',
  'Draft {n}': 'Эскиз {n}', '+ New draft': '+ Новый эскиз', 'New draft': 'Новый эскиз', 'Drawing tools': 'Инструменты рисования', 'Drawing page': 'Лист для рисования',
  'Pen': 'Ручка', 'Marker': 'Маркер', 'Eraser': 'Ластик', 'Line': 'Линия', 'Arrow': 'Стрелка', 'Rectangle': 'Прямоугольник', 'Ellipse': 'Эллипс', 'Text': 'Текст',
  'Colour {c}': 'Цвет {c}', 'Thin': 'Тонкая', 'Medium': 'Средняя', 'Thick': 'Толстая',
  'Type the text to place': 'Введите текст', 'Place': 'Вставить', 'Undo': 'Отменить', 'Redo': 'Вернуть', 'Clear page': 'Очистить лист',
  'Paper': 'Бумага', 'Plain': 'Чистый', 'Grid': 'Клетка', 'Dots': 'Точки', 'Draft name': 'Название эскиза',
  'Save to Notes': 'Сохранить в заметки', 'Save as picture': 'Сохранить как картинку', 'Delete draft': 'Удалить эскиз', 'Delete this draft?': 'Удалить этот эскиз?', 'Keep it': 'Оставить',
  'Saved to Notes': 'Сохранено в заметки', 'Draft deleted': 'Эскиз удалён',
  // copybook (sketch pad pages, kept in Notes)
  'Save page': 'Сохранить лист', 'Nothing drawn on this page yet': 'На этом листе пока ничего не нарисовано',
  'Saved to the copybook, page {n}': 'Сохранено в тетрадь, страница {n}',
  'Copybook': 'Тетрадь', 'Sketches': 'Эскизы', 'Tap to open': 'Нажмите, чтобы открыть', 'Close the copybook': 'Закрыть тетрадь',
  'No pages yet': 'Страниц пока нет', 'Draw something on the sketch pad and tap Save page.': 'Нарисуйте что-нибудь в блокноте для эскизов и нажмите «Сохранить лист».',
  'Page {n} of {total}': 'Страница {n} из {total}', 'Previous page': 'Предыдущая страница', 'Next page': 'Следующая страница',
  'Remove page': 'Удалить страницу', 'Remove this page?': 'Удалить эту страницу?', 'Page removed': 'Страница удалена',
  'Open as picture': 'Открыть как картинку',
  'Drafts are saved on this phone as you draw. Save to Notes to keep a drawing on all your devices.': 'Эскизы сохраняются на этом телефоне по ходу рисования. Сохраните в заметки, чтобы рисунок был на всех устройствах.',
};
