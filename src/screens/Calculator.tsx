import { useCallback, useEffect, useState } from 'react';
import '@/styles/calculator.css';

const SECRET_CODE = '9100';

type Props = {
  onUnlock: () => void;
};

export function Calculator({ onUnlock }: Props) {
  const [current, setCurrent] = useState('0');
  const [previous, setPrevious] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [justEvaluated, setJustEvaluated] = useState(false);

  const roundNicely = (n: number) => Math.round((n + Number.EPSILON) * 1e10) / 1e10;

  const clearAll = useCallback(() => {
    setCurrent('0');
    setPrevious(null);
    setOperator(null);
    setJustEvaluated(false);
  }, []);

  const inputDigit = useCallback(
    (d: string) => {
      setCurrent((cur) => {
        if (justEvaluated) {
          setJustEvaluated(false);
          return d === '.' ? '0.' : d;
        }
        if (d === '.') return cur.includes('.') ? cur : `${cur}.`;
        return cur === '0' ? d : cur + d;
      });
    },
    [justEvaluated],
  );

  const chooseOperator = useCallback(
    (op: string) => {
      if (operator && previous !== null && !justEvaluated) {
        const a = previous;
        const b = parseFloat(current);
        let result = 0;
        switch (operator) {
          case '+':
            result = a + b;
            break;
          case '-':
            result = a - b;
            break;
          case '*':
            result = a * b;
            break;
          case '/':
            result = b === 0 ? NaN : a / b;
            break;
        }
        const next = Number.isNaN(result) ? 'Error' : String(roundNicely(result));
        setPrevious(parseFloat(next) || 0);
        setCurrent('0');
        setOperator(op);
        setJustEvaluated(false);
        return;
      }
      setPrevious(parseFloat(current));
      setOperator(op);
      setJustEvaluated(false);
      setCurrent('0');
    },
    [current, justEvaluated, operator, previous],
  );

  const evaluate = useCallback(() => {
    if (current === SECRET_CODE && operator === null) {
      onUnlock();
      clearAll();
      return;
    }

    if (operator === null || previous === null) return;

    const a = previous;
    const b = parseFloat(current);
    let result = 0;
    switch (operator) {
      case '+':
        result = a + b;
        break;
      case '-':
        result = a - b;
        break;
      case '*':
        result = a * b;
        break;
      case '/':
        result = b === 0 ? NaN : a / b;
        break;
    }

    setCurrent(Number.isNaN(result) ? 'Error' : String(roundNicely(result)));
    setOperator(null);
    setPrevious(null);
    setJustEvaluated(true);
  }, [clearAll, current, onUnlock, operator, previous]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (/[0-9.]/.test(k)) inputDigit(k);
      else if (['+', '-', '*', '/'].includes(k)) chooseOperator(k);
      else if (k === 'Enter' || k === '=') {
        e.preventDefault();
        evaluate();
      } else if (k === 'Escape') clearAll();
      else if (k === 'Backspace') {
        setCurrent((c) => (c.length > 1 ? c.slice(0, -1) : '0'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chooseOperator, clearAll, evaluate, inputDigit]);

  const fontSize = current.length > 9 ? '2.2rem' : '3.2rem';

  return (
    <main className="calc-screen">
      <div className="calc-display">
        <div className="calc-display-value" style={{ fontSize }}>
          {current}
        </div>
      </div>

      <div className="calc-keys">
        <button type="button" className="calc-key fn" onClick={clearAll}>
          AC
        </button>
        <button
          type="button"
          className="calc-key fn"
          onClick={() =>
            setCurrent((c) =>
              c === '0' || c === 'Error' ? c : c.startsWith('-') ? c.slice(1) : `-${c}`,
            )
          }
        >
          +/−
        </button>
        <button
          type="button"
          className="calc-key fn"
          onClick={() => setCurrent(String(roundNicely(parseFloat(current) / 100)))}
        >
          %
        </button>
        <button type="button" className="calc-key op" onClick={() => chooseOperator('/')}>
          ÷
        </button>

        {['7', '8', '9'].map((n) => (
          <button key={n} type="button" className="calc-key" onClick={() => inputDigit(n)}>
            {n}
          </button>
        ))}
        <button type="button" className="calc-key op" onClick={() => chooseOperator('*')}>
          ×
        </button>

        {['4', '5', '6'].map((n) => (
          <button key={n} type="button" className="calc-key" onClick={() => inputDigit(n)}>
            {n}
          </button>
        ))}
        <button type="button" className="calc-key op" onClick={() => chooseOperator('-')}>
          −
        </button>

        {['1', '2', '3'].map((n) => (
          <button key={n} type="button" className="calc-key" onClick={() => inputDigit(n)}>
            {n}
          </button>
        ))}
        <button type="button" className="calc-key op" onClick={() => chooseOperator('+')}>
          +
        </button>

        <button type="button" className="calc-key zero" onClick={() => inputDigit('0')}>
          0
        </button>
        <button type="button" className="calc-key" onClick={() => inputDigit('.')}>
          .
        </button>
        <button type="button" className="calc-key eq" onClick={evaluate}>
          =
        </button>
      </div>
    </main>
  );
}
