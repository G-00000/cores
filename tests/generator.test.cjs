const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const html = readFileSync(`${__dirname}/../index.html`, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function page(fetchResponse, key = 'test-key') {
    const elements = Object.fromEntries(
        ['apiKey', 'apiSettings', 'questionButton', 'colorBox', 'message', 'image']
            .map(id => [id, { style: {}, focus() { this.focused = true; } }])
    );
    elements.apiKey.value = key;
    const calls = [];
    let timer;
    let timerCleared = false;
    const context = vm.createContext({
        document: { getElementById: id => elements[id] },
        AbortController, TypeError,
        setTimeout(callback, delay) {
            assert.equal(delay, 10000);
            timer = callback;
            return 1;
        },
        clearTimeout(id) { assert.equal(id, 1); timerCleared = true; },
        fetch(url, options) {
            calls.push({ url, options });
            return fetchResponse(url, options);
        }
    });
    vm.runInContext(script, context);
    return {
        elements, calls,
        generate: () => context.generateColor(),
        expire: () => timer(),
        timerCleared: () => timerCleared,
        changeImage: () => context.changeImage()
    };
}

function success(number) {
    return { ok: true, status: 200, json: async () => ({
        success: true, type: 'uint8', length: 1, data: [number]
    }) };
}

test('all 256 possible bytes preserve the digit-sum rules and colour mapping', async () => {
    const colours = ['blue', 'red', 'red', 'gray', 'yellow', 'gray', 'gray', 'yellow', 'green', 'green'];
    const names = ['Azul', 'Vermelho', 'Vermelho', 'Cinzento', 'Amarelo', 'Cinzento', 'Cinzento', 'Amarelo', 'Verde', 'Verde'];
    for (let number = 0; number <= 255; number++) {
        const p = page(async () => success(number));
        await p.generate();
        // Independent digital-root formula, rather than duplicating the implementation.
        const root = number === 0 ? 0 : 1 + (number - 1) % 9;
        assert.equal(p.elements.colorBox.style.backgroundColor, colours[root], `byte ${number}`);
        assert.equal(p.elements.message.textContent, names[root], `byte ${number}`);
        assert.equal(p.calls.length, 1);
        assert.equal(p.calls[0].url, 'https://api.quantumnumbers.anu.edu.au?length=1&type=uint8');
        assert.equal(p.calls[0].options.headers['x-api-key'], 'test-key');
        assert.equal(p.calls[0].options.cache, 'no-store');
        assert.equal(p.elements.questionButton.disabled, false);
        assert.equal(p.timerCleared(), true);
    }
});

test('missing key requests configuration without contacting ANU', async () => {
    const p = page(() => assert.fail('must not send a request'), '  ');
    await p.generate();
    assert.equal(p.elements.apiSettings.open, true);
    assert.equal(p.elements.apiKey.focused, true);
    assert.match(p.elements.message.textContent, /chave/);
});

test('repeated activation sends only one request and allows another after completion', async () => {
    let resolve;
    const p = page(() => new Promise(done => { resolve = done; }));
    const pending = p.generate();
    assert.equal(p.elements.questionButton.disabled, true);
    await p.generate();
    assert.equal(p.calls.length, 1);
    resolve(success(255));
    await pending;
    const again = p.generate();
    assert.equal(p.calls.length, 2);
    resolve(success(10));
    await again;
    assert.equal(p.elements.message.textContent, 'Vermelho');
});

test('HTTP failures, invalid responses and network failures never generate a colour', async () => {
    const cases = [
        [async () => ({ status: 401, ok: false }), /recusou/],
        [async () => ({ status: 403, ok: false }), /recusou/],
        [async () => ({ status: 429, ok: false }), /Limite/],
        [async () => ({ status: 500, ok: false }), /indisponível/],
        [async () => ({ status: 200, ok: true, json: async () => { throw new SyntaxError(); } }), /inválida/],
        [async () => { throw new TypeError('Failed to fetch'); }, /contactar/]
    ];
    const valid = await success(100).json();
    for (const invalid of [
        null, {}, { ...valid, success: false }, { ...valid, type: 'uint16' },
        { ...valid, length: 2 }, { ...valid, data: [] }, { ...valid, data: [1, 2] },
        ...[-1, 256, 1.5, '42', null].map(value => ({ ...valid, data: [value] }))
    ]) {
        cases.push([async () => ({ ok: true, status: 200, json: async () => invalid }), /válido/]);
    }
    for (const [fetchResponse, message] of cases) {
        const p = page(fetchResponse);
        p.elements.colorBox.style.backgroundColor = 'green';
        await p.generate();
        assert.equal(p.elements.colorBox.style.backgroundColor, 'green');
        assert.match(p.elements.message.textContent, message);
        assert.equal(p.elements.questionButton.disabled, false);
        assert.equal(p.timerCleared(), true);
    }
});

test('unresponsive request is cancelled and the button becomes available again', async () => {
    const p = page((url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
    }));
    const pending = p.generate();
    p.expire();
    await pending;
    assert.match(p.elements.message.textContent, /demasiado/);
    assert.equal(p.elements.questionButton.disabled, false);
    assert.equal(p.elements.colorBox.style.backgroundColor, undefined);
    assert.equal(p.timerCleared(), true);
});

test('image cycling remains unchanged', () => {
    const p = page(() => assert.fail('must not send a request'));
    for (const index of [2, 3, 1]) {
        p.changeImage();
        assert.equal(p.elements.image.src, `imagem${index}.png`);
    }
});
