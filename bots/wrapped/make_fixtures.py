"""Writes small synthetic chat exports for the Group Chat Wrapped tests.
Every name and message is made up. Run: python3 bots/wrapped/make_fixtures.py"""
import json, os, zipfile, subprocess
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
os.makedirs(D, exist_ok=True)
LRM, NNB = '‎', ' '

def w(name, text):
    with open(os.path.join(D, name), 'w', encoding='utf-8', newline='') as f:
        f.write(text)

# iOS, US, 12h with seconds, narrow no-break space before AM/PM, LRM-marked system lines.
w('ios_us_12h.txt', '\n'.join([
    f'[3/14/25, 9:00:00{NNB}AM] Taco Tuesday Club: {LRM}Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.',
    f'[3/14/25, 9:00:00{NNB}AM] Taco Tuesday Club: {LRM}Ana Ruiz created group “Taco Tuesday Club”',
    f'[3/14/25, 9:01:05{NNB}AM] Ana Ruiz: who is in for tuesday \U0001F32E\U0001F32E',
    f'[3/14/25, 9:01:40{NNB}AM] Ben Ito: me!! lol',
    f'{LRM}[3/14/25, 9:02:10{NNB}AM] Ben Ito: {LRM}image omitted',
    f'[3/14/25, 9:03:00{NNB}AM] ~{NNB}Cleo: first line',
    'second line of the same message',
    'third line',
    f'[3/14/25, 11:59:59{NNB}PM] Ana Ruiz: {LRM}This message was deleted.',
    f'[3/15/25, 12:30:00{NNB}AM] Ben Ito: still up haha {LRM}<This message was edited>',
    f'[3/15/25, 12:31:00{NNB}AM] Taco Tuesday Club: {LRM}Ben Ito added Dev',
    f'[3/15/25, 12:00:00{NNB}PM] Ana Ruiz: noon check',
]) + '\n')

# Android, US, 12h, no seconds.
w('android_us_12h.txt', '\n'.join([
    '1/5/25, 8:15 PM - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Tap to learn more.',
    '1/5/25, 8:15 PM - Ana Ruiz created group "Board Game Night"',
    '1/5/25, 8:16 PM - Ana Ruiz added Ben Ito',
    '1/5/25, 8:17 PM - Ana Ruiz changed the subject from "Games" to "Board Game Night: S2"',
    '1/5/25, 8:18 PM - Ben Ito: <Media omitted>',
    '1/5/25, 8:19 PM - Ana Ruiz: ok rules:',
    '1. no flipping the board',
    '2. snacks are mandatory',
    '1/5/25, 12:05 AM - Ben Ito: hahaha fine',
    '1/13/25, 7:45 AM - Cleo Park: morning ☀️',
    '1/13/25, 7:46 AM - Ben Ito left',
]) + '\n')

# Android, UK, DD/MM/YYYY, 24h (day > 12 makes the order explicit).
w('android_uk_24h.txt', '\n'.join([
    '25/12/2024, 09:00 - Ana Ruiz: merry christmas \U0001F384',
    '25/12/2024, 23:59 - Ben Ito: same to you',
    '26/12/2024, 00:10 - Cleo Park: boxing day plans?',
    '26/12/2024, 13:45 - Ana Ruiz: <Media omitted>',
]) + '\n')

# Android, DD/MM 24h where every day is <= 12: only chronology can tell.
w('android_ambiguous_dmy.txt', '\n'.join([
    '11/03/2025, 10:00 - Ana Ruiz: one',
    '12/03/2025, 10:00 - Ben Ito: two',
    '01/04/2025, 10:00 - Ana Ruiz: three',
    '02/04/2025, 10:00 - Ben Ito: four',
    '03/05/2025, 10:00 - Ana Ruiz: five',
]) + '\n')

# iOS, German locale: dots and 24h.
w('ios_de_24h_dots.txt', '\n'.join([
    '[15.01.24, 21:05:12] Ana Ruiz: hallo zusammen',
    '[15.01.24, 21:06:00] Ben Ito: servus',
    f'[16.01.24, 07:00:00] Ben Ito: {LRM}Bild weggelassen',
    '[16.01.24, 07:01:00] Ben Ito: <Medien ausgeschlossen>',
]) + '\n')

# Android, Spanish style "p. m." with day-first dates.
w('android_es_pm.txt', '\n'.join([
    f'15/1/24, 9:05{NNB}p.{NNB}m. - Ana Ruiz: hola jajaja',
    f'15/1/24, 9:06{NNB}p.{NNB}m. - Ben Ito: <Multimedia omitido>',
    f'16/1/24, 12:10{NNB}a.{NNB}m. - Ben Ito: buenas noches',
]) + '\n')

# Telegram Desktop single-chat export.
tg = {
    'name': 'Book Swap', 'type': 'private_supergroup', 'id': 99,
    'messages': [
        {'id': 1, 'type': 'service', 'date': '2025-02-01T10:00:00', 'actor': 'Ana Ruiz', 'action': 'create_group', 'text': ''},
        {'id': 2, 'type': 'message', 'date': '2025-02-01T10:01:00', 'date_unixtime': '1738404060', 'from': 'Ana Ruiz', 'from_id': 'user1', 'text': 'welcome \U0001F4DA'},
        {'id': 3, 'type': 'message', 'date': '2025-02-01T10:02:30', 'from': 'Ben Ito', 'from_id': 'user2',
         'text': [{'type': 'bold', 'text': 'lol'}, ' thanks ', {'type': 'link', 'text': 'https://example.com'}]},
        {'id': 4, 'type': 'message', 'date': '2025-02-02T02:15:00', 'from': 'Ben Ito', 'from_id': 'user2', 'photo': '(File not included.)', 'text': ''},
        {'id': 5, 'type': 'message', 'date': '2025-02-02T08:00:00', 'from': None, 'from_id': 'user3', 'text': 'from a deleted account'},
        {'id': 6, 'type': 'message', 'date': '2025-02-02T08:01:00', 'from': 'Cleo Park', 'from_id': 'user4', 'sticker_emoji': '\U0001F44D', 'media_type': 'sticker', 'text': ''},
    ]}
w('telegram_result.json', json.dumps(tg, ensure_ascii=False, indent=1))

# Telegram full-account export (chats.list); the busiest group should be picked.
full = {'about': 'synthetic', 'chats': {'about': '', 'list': [
    {'name': 'Ana Ruiz', 'type': 'personal_chat', 'id': 1, 'messages': [
        {'id': i, 'type': 'message', 'date': '2025-03-01T10:00:%02d' % i, 'from': 'Ana Ruiz', 'text': 'dm'} for i in range(9)]},
    {'name': 'Book Swap', 'type': 'private_supergroup', 'id': 99, 'messages': tg['messages']},
]}}
w('telegram_full_export.json', json.dumps(full, ensure_ascii=False))

# Larger synthetic decks for the browser tests, generated from docs/wrapped/demo.js.
root = os.path.abspath(os.path.join(D, '..', '..', '..'))
js = ("const D=require(process.argv[1]);const fs=require('fs');"
      "fs.writeFileSync(process.argv[2],D.whatsappText(7));"
      "fs.writeFileSync(process.argv[3],JSON.stringify(D.telegramJson(11),null,1));")
subprocess.run(['node', '-e', js, os.path.join(root, 'docs/wrapped/demo.js'),
                os.path.join(D, 'WhatsApp Chat with Weekend Crew.txt'), os.path.join(D, 'result.json')], check=True)
with zipfile.ZipFile(os.path.join(D, 'WhatsApp Chat - Weekend Crew.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(os.path.join(D, 'WhatsApp Chat with Weekend Crew.txt'), '_chat.txt')
# ---- QA Nov 15 2026: locale and iOS 1:1 gaps ----
L = '‎'
# iOS 1:1 chat: the contact's own name carries the system lines (encryption notice, missed calls).
w('ios_1to1_us.txt', '\n'.join([
    f'[1/15/26, 9:00:00 PM] Priya Shah: {L}Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.',
    '[1/15/26, 9:05:12 PM] Priya Shah: are we still on for friday',
    '[1/15/26, 9:06:40 PM] Tom Reyes: yes!! 7pm',
    f'[1/15/26, 9:30:02 PM] Priya Shah: {L}Missed voice call, {L}Tap to call back',
    f'[1/15/26, 9:31:15 PM] Tom Reyes: {L}POLL:\nWhich place?\n{L}OPTION: Thai (1 vote)\n{L}OPTION: Pizza (1 vote)',
    f'[1/15/26, 9:32:00 PM] Priya Shah: {L}image omitted',
    '[1/16/26, 8:01:44 AM] Priya Shah: morning ☀️',
    '[1/16/26, 8:02:10 AM] Tom Reyes: hahaha morning',
]) + '\n')
# Korean Android: "2026. 1. 15. 오후 9:05 - " (spaces after dots, AM/PM word before the time).
w('android_ko.txt', '\n'.join([
    '2026. 1. 15. 오후 9:05 - 지민: 안녕',
    '2026. 1. 15. 오후 9:07 - Sam: hi!',
    '2026. 1. 16. 오전 7:30 - 지민: 좋은 아침',
    '2026. 1. 16. 오후 12:15 - Sam: lunch',
]) + '\n')
# Chinese Android: "2026/1/15 下午9:05 - ".
w('android_zh.txt', '\n'.join([
    '2026/1/15 下午9:05 - 小明: 你好',
    '2026/1/15 下午9:06 - Sam: hello',
    '2026/1/16 上午8:00 - 小明: 早',
]) + '\n')
# Finnish Android: "15.1.2026 klo 21.05 - ".
w('android_fi_klo.txt', '\n'.join([
    '15.1.2026 klo 21.05 - Aino: moi',
    '15.1.2026 klo 21.06 - Sam: hei',
    '16.1.2026 klo 7.45 - Aino: huomenta',
]) + '\n')
# Czech Android: "15. 1. 2026 21:05 - ", plus German-style localized attachment line.
w('android_cs_spaced.txt', '\n'.join([
    '15. 1. 2026 21:05 - Petra: ahoj',
    '15. 1. 2026 21:06 - Sam: IMG-20260115-WA0001.jpg (soubor připojen)',
    '16. 1. 2026 7:45 - Petra: dobré ráno',
]) + '\n')
w('android_de_attached.txt', '\n'.join([
    '15.01.26, 21:05 - Lena: Hallo',
    '15.01.26, 21:06 - Sam: IMG-20260115-WA0001.jpg (Datei angehängt)',
    '15.01.26, 21:07 - Lena: PTT-20260115-WA0002.opus (Datei angehängt)',
    '16.01.26, 07:45 - Sam: Guten Morgen',
]) + '\n')
# Arabic Android: Arabic-Indic digits, RLM marks, Arabic comma and ص/م for AM/PM.
w('android_ar_digits.txt', '\n'.join([
    '١٥‏/١‏/٢٠٢٦، ٩:٠٥ م - Omar: hi',
    '١٥‏/١‏/٢٠٢٦، ٩:٠٦ م - Sam: hello',
    '١٦‏/١‏/٢٠٢٦، ٧:٤٥ ص - Omar: morning',
]) + '\n')
# Telegram Desktop's default export is HTML, not JSON.
w('telegram_messages.html', '<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"/><title>Exported Data</title></head>\n'
  '<body><div class="page_wrap"><div class="page_header"><div class="text bold">Book Swap</div></div>'
  '<div class="message default clearfix" id="message1"><div class="from_name">Ana</div><div class="text">hi</div></div></div></body>\n</html>\n')

print('fixtures written to', D)
