import { Component, type ReactNode } from 'react';

/** Не оставляет ребёнка перед пустым экраном при неожиданной ошибке интерфейса. */
export class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  /** Переключает интерфейс на безопасную подсказку без удаления прогресса. */
  static getDerivedStateFromError() { return { failed: true }; }

  /** Показывает повторную загрузку, сохраняя локальные данные. */
  render() {
    if (this.state.failed) return <main className="error-boundary"><img src="/icons/icon.svg" alt="Волчонок-помощник" width="100" height="100" /><h1>Упс, давай попробуем снова!</h1><p>Приложению нужна маленькая пауза. Мы не удаляли твой сохранённый прогресс.</p><button className="button button-primary" onClick={() => window.location.reload()}>Вернуться к путешествию</button></main>;
    return this.props.children;
  }
}