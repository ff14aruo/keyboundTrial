(() => {
  'use strict';

  const PRAISE = ['いいね!', 'その調子!', 'ばっちり!', 'よくできました!'];
  const SYMBOL_RE = /[\s　、。，．,.!?！？「」『』（）()・…:：;；]/;
  const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

  // ---- お題のパース ----
  function parse(src) {
    const segs = [];
    const re = /\[([^\]|]+)\|([^\]]+)\]/g;
    const pushText = (str) => { // カタカナのかたまりには読みを自動で付ける
      const kataRe = /[ァ-ヺ][ァ-ヺー]*/g;
      let last = 0, m;
      while ((m = kataRe.exec(str))) {
        if (m.index > last) { const t = str.slice(last, m.index); segs.push({ text: t, reading: t, ruby: false, symbol: false }); }
        segs.push({ text: m[0], reading: toHira(m[0]), ruby: true, kata: true, symbol: false });
        last = kataRe.lastIndex;
      }
      if (last < str.length) { const t = str.slice(last); segs.push({ text: t, reading: t, ruby: false, symbol: false }); }
    };
    const pushPlain = (str) => {
      let buf = '';
      for (const ch of str) {
        if (SYMBOL_RE.test(ch)) {
          if (buf) { pushText(buf); buf = ''; }
          segs.push({ text: ch, reading: '', ruby: false, symbol: true });
        } else buf += ch;
      }
      if (buf) pushText(buf);
    };
    let last = 0, m;
    while ((m = re.exec(src))) {
      pushPlain(src.slice(last, m.index));
      segs.push({ text: m[1], reading: m[2], ruby: true, symbol: false });
      last = re.lastIndex;
    }
    pushPlain(src.slice(last));
    return segs;
  }

  // ---- 判定 ----
  function normalize(s) {
    return s.normalize('NFKC')
      .replace(/ヴ/g, 'ゔ')
      .replace(/[\s、。,.!?「」『』()・…:;]/g, '')
      .replace(/[〜~]/g, '〜')
      .replace(/[ー\-−‐―]/g, 'ー');
  }
  const same = (expected, typed) => expected === typed || (expected === '〜' && typed === 'ー');

  // 区切りごとに「よみ」か「表示」のどちらでもよい照合(変換中の色ガイド用。混ざっていても途中経過として許す)
  function matchLoose(segs, typed) {
    let pos = 0, yomi = 0;
    for (const s of segs) {
      const r = normalize(s.reading);
      const t = s.ruby ? normalize(s.text) : '';
      if (t && typed.startsWith(t, pos)) { pos += t.length; yomi += r.length; continue; }
      for (const ch of r) {
        if (pos >= typed.length) return { green: yomi, red: null, done: false, used: pos };
        if (!same(ch, typed[pos])) return { green: yomi, red: yomi, done: false, used: pos };
        pos++; yomi++;
      }
    }
    const extra = pos < typed.length;
    return { green: yomi, red: extra ? yomi : null, done: !extra, used: pos };
  }

  // 1つの書き方だけで照合する。asShown=false: 全部ひらがな / true: 全部お題どおり
  function matchAs(segs, typed, asShown) {
    let pos = 0, yomi = 0;
    for (const s of segs) {
      const r = normalize(s.reading);
      if (asShown && s.ruby) {
        const t = normalize(s.text);
        const rest = typed.slice(pos);
        if (rest.startsWith(t)) { pos += t.length; yomi += r.length; continue; }
        if (t.startsWith(rest)) return { green: yomi, red: null, done: false, used: typed.length };
        return { green: yomi, red: yomi, done: false, used: pos };
      }
      for (const ch of r) {
        if (pos >= typed.length) return { green: yomi, red: null, done: false, used: pos };
        if (!same(ch, typed[pos])) return { green: yomi, red: yomi, done: false, used: pos };
        pos++; yomi++;
      }
    }
    const extra = pos < typed.length;
    return { green: yomi, red: extra ? yomi : null, done: !extra, used: pos };
  }

  // 「全部ひらがな」か「全部お題どおり」のどちらかと一致すればOK。混ぜた入力はNG
  function check(segs, input, composing = false) {
    const typed = normalize(input);
    if (composing) return matchLoose(segs, typed.replace(/[a-z]+$/i, ''));
    const kana = matchAs(segs, typed, false);
    const shown = matchAs(segs, typed, true);
    if (kana.done) return kana;
    if (shown.done) return shown;
    return shown.used > kana.used ? shown : kana;
  }

  // ---- かな → ローマ字例 ----
  const R1 = {
    'あ':'a','い':'i','う':'u','え':'e','お':'o',
    'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
    'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
    'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
    'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
    'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
    'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
    'や':'ya','ゆ':'yu','よ':'yo',
    'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
    'わ':'wa','を':'wo','ん':'nn',
    'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
    'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
    'だ':'da','ぢ':'di','づ':'du','で':'de','ど':'do',
    'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
    'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
    'ゔ':'vu',
    'ぁ':'xa','ぃ':'xi','ぅ':'xu','ぇ':'xe','ぉ':'xo',
    'ゃ':'xya','ゅ':'xyu','ょ':'xyo','っ':'xtu',
    'ー':'-','〜':'-',
  };
  const R2 = {
    'きゃ':'kya','きゅ':'kyu','きょ':'kyo',
    'しゃ':'sha','しゅ':'shu','しょ':'sho','しぇ':'she',
    'ちゃ':'cha','ちゅ':'chu','ちょ':'cho','ちぇ':'che',
    'にゃ':'nya','にゅ':'nyu','にょ':'nyo',
    'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
    'みゃ':'mya','みゅ':'myu','みょ':'myo',
    'りゃ':'rya','りゅ':'ryu','りょ':'ryo',
    'ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
    'じゃ':'ja','じゅ':'ju','じょ':'jo','じぇ':'je',
    'びゃ':'bya','びゅ':'byu','びょ':'byo',
    'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo',
    'ふぁ':'fa','ふぃ':'fi','ふぇ':'fe','ふぉ':'fo',
    'てぃ':'thi','でぃ':'dhi','うぃ':'wi','うぇ':'we','うぉ':'who',
    'ゔぁ':'va','ゔぃ':'vi','ゔぇ':'ve','ゔぉ':'vo',
    'つぁ':'tsa','つぃ':'tsi','つぇ':'tse','つぉ':'tso',
  };

  // 入力例を「かなのかたまり」に分け、それぞれのローマ字例を付ける
  function toChunks(ans) {
    const chars = Array.from(ans);
    const raw = [];
    for (let i = 0; i < chars.length;) {
      const two = chars[i] + (chars[i + 1] || '');
      if (chars[i + 1] && R2[two]) { raw.push({ text: two, rom: R2[two] }); i += 2; }
      else { raw.push({ text: chars[i], rom: R1[chars[i]] || chars[i] }); i += 1; }
    }
    const chunks = [];
    for (let i = 0; i < raw.length; i++) {
      const u = raw[i], nx = raw[i + 1];
      if (u.text === 'っ' && nx && /^[bcdfghjkmpqrstvwz]/.test(nx.rom)) {
        chunks.push({ text: u.text + nx.text, rom: nx.rom[0] + nx.rom });
        i++;
      } else chunks.push(u);
    }
    let pos = 0;
    for (const c of chunks) { c.start = pos; c.len = Array.from(c.text).length; pos += c.len; }
    return chunks;
  }

  // ---- 保存(この試作では設定と「遊び方を見たか」だけ) ----
  const store = (() => {
    let data = {};
    try { data = JSON.parse(localStorage.getItem('hiragana-typing-proto') || '{}') || {}; } catch (e) { data = {}; }
    return {
      get: (k, d) => (k in data ? data[k] : d),
      set: (k, v) => { data[k] = v; try { localStorage.setItem('hiragana-typing-proto', JSON.stringify(data)); } catch (e) { /* 保存できなくても動く */ } },
    };
  })();

  // ---- 状態 ----
  let level = 1, list = [];
  let idx = 0, segs = [], checkSegs = [], answer = '', answerLen = 0, chunks = [];
  let state = 'typing'; // typing | ok | ng
  let composing = false;
  let stumbled = [];

  const $ = (id) => document.getElementById(id);
  const odaiEl = $('odai'), romajiEl = $('romaji'), exampleEl = $('example');
  const imeInput = $('imeInput'), resultEl = $('result'), progressEl = $('progress'), checkLabel = $('checkLabel');
  const practiceEl = $('practice'), finishEl = $('finish');

  // ---- 描画(すべて textContent / createElement で組み立てる) ----
  // お題にも色ガイドを付ける(ふりがなは付けない)。ひらがなは1文字ずつ、漢字・カタカナは読みを打ち終えた所でまとめて
  function renderOdai(green, red) {
    odaiEl.replaceChildren();
    const mark = (el, i) => {
      if (i < green) el.className = 'ok';
      else if (red !== null && i === red) el.className = 'bad';
      else if (red === null && i === green && state !== 'ok') el.className = 'next';
    };
    const charSpan = (ch, i) => {
      const c = document.createElement('span');
      c.textContent = ch;
      mark(c, i);
      return c;
    };
    let pos = 0;
    for (const s of segs) {
      if (s.symbol) {
        const sp = document.createElement('span');
        sp.className = 'sym';
        sp.textContent = s.text;
        odaiEl.append(sp);
        continue;
      }
      const start = pos, end = pos + Array.from(normalize(s.reading)).length;
      pos = end;
      if (s.ruby && !s.kata) { // 漢字はまとめて色を付ける(カタカナは1文字ずつ)
        const base = document.createElement('span');
        base.textContent = s.text;
        if (end <= green) base.className = 'ok';
        else if (red !== null && red >= start && red < end) base.className = 'bad';
        else if (red === null && green >= start && green < end && state !== 'ok') base.className = 'next';
        odaiEl.append(base);
      } else {
        Array.from(s.text).forEach((ch, k) => odaiEl.append(charSpan(ch, start + k)));
      }
    }
  }

  function renderExample(green, red) {
    exampleEl.replaceChildren();
    Array.from(answer).forEach((ch, i) => {
      const sp = document.createElement('span');
      sp.textContent = ch === '〜' ? 'ー' : ch; // 入力例では〜をーで見せる
      if (i < green) sp.className = 'ok';
      else if (red !== null && i === red) sp.className = 'bad';
      else if (red === null && i === green && state !== 'ok') sp.className = 'next';
      exampleEl.append(sp);
    });
  }

  function renderRomaji(green, focusIdx) {
    romajiEl.replaceChildren();
    for (const c of chunks) {
      const sp = document.createElement('span');
      sp.className = 'chunk';
      sp.textContent = c.rom;
      if (c.start + c.len <= green) sp.classList.add('done');
      if (focusIdx !== null && focusIdx >= c.start && focusIdx < c.start + c.len) sp.classList.add('next');
      romajiEl.append(sp);
    }
  }

  function setResult(kind, badge, text) {
    resultEl.className = 'result' + (kind ? ' ' + kind : '');
    resultEl.replaceChildren();
    if (!kind) return;
    if (badge) {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = badge;
      resultEl.append(b);
    }
    const t = document.createElement('span');
    t.textContent = text;
    resultEl.append(t);
  }

  function render() {
    const res = state === 'ok' ? { green: answerLen, red: null } : check(checkSegs, imeInput.value, composing);
    const focus = res.red !== null ? res.red : (res.green < answerLen ? res.green : null);
    renderOdai(res.green, res.red);
    renderExample(res.green, res.red);
    renderRomaji(res.green, focus);
    checkLabel.textContent = state === 'ok' ? '次へ' : '答え合わせ';
  }

  // ---- お題の切り替え ----
  function load(i) {
    idx = i;
    segs = parse(list[i]);
    checkSegs = segs.filter((s) => !s.symbol);
    answer = normalize(checkSegs.map((s) => s.reading).join(''));
    answerLen = Array.from(answer).length;
    chunks = toChunks(answer);
    state = 'typing'; composing = false;
    imeInput.value = '';
    imeInput.readOnly = false;
    progressEl.textContent = `${i + 1} / ${list.length}`;
    practiceEl.hidden = false;
    finishEl.hidden = true;
    setResult('', '', '');
    render();
  }

  function next() {
    if (idx + 1 < list.length) { load(idx + 1); focusTarget(); }
    else showFinish();
  }

  function showFinish() {
    practiceEl.hidden = true;
    finishEl.hidden = false;
    $('finishSummary').textContent = `LV${level}の${list.length}問をクリアしました。`;
    const missEl = $('finishMiss');
    missEl.replaceChildren();
    list.forEach((src, i) => {
      if (!stumbled[i]) return;
      const li = document.createElement('li');
      li.textContent = parse(src).map((s) => s.text).join('');
      missEl.append(li);
    });
    $('finishMissWrap').hidden = missEl.children.length === 0;
    $('restartBtn').focus();
  }

  // レベル内のお題は毎回シャッフルして出す
  function shuffle(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }

  function setLevel(n) {
    level = LEVELS[n] ? n : 1;
    store.set('level', level);
    [1, 2, 3].forEach((k) => $('lv' + k).setAttribute('aria-checked', String(k === level)));
    $('levelLabel').textContent = 'LV' + level;
    restart();
  }

  function restart() {
    stumbled = [];
    list = shuffle(LEVELS[level]);
    load(0);
    focusTarget();
  }

  // ---- 答え合わせ ----
  function hintFor(input, res) {
    const t = normalize(input);
    if (/n/i.test(t)) return '「ん」が n のまま残っているよ。N を2回(nn)打とう';
    if (res.red !== null && answer[res.red] === 'ん') return '「ん」の次があ行・な行・や行なら nn と打つ';
    if (/[a-z]/i.test(t)) return '日本語入力がOFFになっていない?';
    const hasKanji = /[㐀-鿿]/.test(t), hasKata = /[ァ-ヺ]/.test(t);
    if ((hasKanji || hasKata) && matchLoose(checkSegs, t).done) return '一部だけひらがなになっているよ。全部ひらがなか、全部お題どおりにしてね';
    if (hasKanji) return '変換ミスかも。ひらがなのまま打つと確実';
    if (hasKata) return 'ひらがなの所は、ひらがなのまま確定してね';
    if (res.red === null) return 'まだ最後まで打てていないよ';
    if (res.red >= answerLen) return '余分な文字があるよ。最後の文字を消してみて';
    return '赤くなった文字を確認してね';
  }

  function submit() {
    if (state === 'ok') { next(); return; }
    const res = check(checkSegs, imeInput.value);
    if (res.done) {
      state = 'ok';
      imeInput.readOnly = true;
      setResult('ok', 'OK', PRAISE[idx % PRAISE.length] + ' Enterで次へ');
    } else {
      state = 'ng';
      stumbled[idx] = true;
      setResult('ng', 'NG', hintFor(imeInput.value, res));
    }
    render();
  }

  function clearInput() {
    imeInput.value = '';
    imeInput.readOnly = false;
    state = 'typing';
    setResult('', '', '');
    render();
  }

  imeInput.addEventListener('compositionstart', () => { composing = true; });
  imeInput.addEventListener('compositionend', () => { composing = false; render(); });
  imeInput.addEventListener('input', (e) => { composing = e.isComposing || composing; render(); });
  imeInput.addEventListener('paste', (e) => e.preventDefault());
  imeInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== 'Escape') return;
    if (e.isComposing || e.keyCode === 229) return; // 変換の確定・取り消しのキーは無視
    e.preventDefault();
    if (e.key === 'Enter') submit(); else clearInput();
  });

  // ---- 共通の操作 ----
  function focusTarget() {
    if ($('help').open || !finishEl.hidden) return;
    imeInput.focus();
  }

  $('romajiToggle').addEventListener('change', (e) => {
    $('romajiRow').hidden = !e.target.checked;
    store.set('romaji', e.target.checked);
    focusTarget();
  });
  $('checkBtn').addEventListener('click', () => { submit(); focusTarget(); });
  $('clearBtn').addEventListener('click', () => { clearInput(); focusTarget(); });
  $('exampleToggle').addEventListener('change', (e) => {
    $('exampleRow').hidden = !e.target.checked;
    store.set('example', e.target.checked);
    focusTarget();
  });
  $('restartBtn').addEventListener('click', restart);
  $('card').addEventListener('pointerup', (e) => {
    if (e.target.closest('button, input, label')) return;
    focusTarget();
  });
  document.addEventListener('keydown', (e) => {
    if ($('help').open) return;
    if (!finishEl.hidden && e.key === 'Enter' && document.activeElement !== $('restartBtn')) { e.preventDefault(); restart(); }
  });

  // ---- 遊び方ポップアップ(説明文は1文ずつ改行) ----
  const SLIDES = [
    ['お題の見方', ['お題の上に、ひらがなの入力例が表示されます。','「、」「！」などの記号は、入力しなくても構いません。', '「〜」は「ー」で代用できます。']],
    ['ひらがなで入力する', ['日本語入力をONにして入力します。', '変換せず、ひらがなのまま入力する方が速く打てます。', '漢字に変換する場合は、すべてお題の通りに変換してください。']],
    ['ローマ字はキーの目安', ['「ローマ字例」にチェックを入れると、押すキーの目安が表示されます。', '「ho」と表示されている場合は、H と O のキーを押します。', '「ん」は N のキーを2回押します。', '「し」は「si」でも「shi」でも入力できます。']],
    ['色で確認する', ['合っている文字は緑で表示されます。', '違う文字は赤で表示されます。']],
    ['Enterで答え合わせ', ['間違えたら、Escで全部消して、やり直せます。']],
  ];
  const help = $('help');
  let slide = 0;

  function renderSlide() {
    const [title, lines] = SLIDES[slide];
    $('helpStep').textContent = `遊び方 ${slide + 1} / ${SLIDES.length}`;
    $('helpTitle').textContent = title;
    const body = $('helpBody');
    body.replaceChildren();
    for (const line of lines) {
      const p = document.createElement('p');
      p.textContent = line;
      body.append(p);
    }
    $('helpBack').disabled = slide === 0;
    $('helpNext').textContent = slide === SLIDES.length - 1 ? 'はじめる' : '次へ';
    const dots = $('helpDots');
    dots.replaceChildren();
    SLIDES.forEach((_, i) => {
      const d = document.createElement('span');
      if (i === slide) d.className = 'on';
      dots.append(d);
    });
  }
  function openHelp() {
    slide = 0;
    renderSlide();
    if (typeof help.showModal === 'function') help.showModal(); else help.setAttribute('open', '');
    $('helpNext').focus();
  }
  function closeHelp() {
    if (help.open) { if (typeof help.close === 'function') help.close(); else help.removeAttribute('open'); }
  }
  help.addEventListener('close', () => { store.set('seenHelp', true); focusTarget(); });
  $('helpBtn').addEventListener('click', openHelp);
  $('helpClose').addEventListener('click', closeHelp);
  $('helpBack').addEventListener('click', () => { if (slide > 0) { slide--; renderSlide(); } });
  $('helpNext').addEventListener('click', () => {
    if (slide < SLIDES.length - 1) { slide++; renderSlide(); } else closeHelp();
  });
  help.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); $('helpNext').click(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); $('helpBack').click(); }
  });
  help.addEventListener('click', (e) => { if (e.target === help) closeHelp(); });

  // ---- 起動 ----
  const romajiOn = store.get('romaji', false) === true; // ローマ字例は初期OFF
  $('romajiToggle').checked = romajiOn;
  $('romajiRow').hidden = !romajiOn;
  const exampleOn = store.get('example', true) !== false;
  $('exampleToggle').checked = exampleOn;
  $('exampleRow').hidden = !exampleOn;
  [1, 2, 3].forEach((k) => {
    $('lv' + k + 'n').textContent = LEVELS[k].length + '問';
    $('lv' + k).addEventListener('click', () => setLevel(k));
  });
  setLevel(Number(store.get('level', 1)));
  if (!store.get('seenHelp', false)) openHelp();
})();