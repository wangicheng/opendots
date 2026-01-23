import { en } from './locales/en';

export type TranslationKey = keyof typeof en;
type LocaleData = Record<string, string>;

export class LanguageManager {
  private static instance: LanguageManager;
  private currentLang: string = 'en';
  private locales: Record<string, LocaleData> = {};
  private listeners: (() => void)[] = [];

  private constructor() {
    this.currentLang = localStorage.getItem('braindots_language') || 'en';
  }

  public static getInstance(): LanguageManager {
    if (!LanguageManager.instance) {
      LanguageManager.instance = new LanguageManager();
    }
    return LanguageManager.instance;
  }

  public registerLocale(lang: string, data: LocaleData): void {
    this.locales[lang] = data;
  }

  public setLanguage(lang: string): void {
    if (this.currentLang !== lang) {
      this.currentLang = lang;
      localStorage.setItem('braindots_language', lang);
      this.notifyListeners();
    }
  }

  public getCurrentLanguage(): string {
    return this.currentLang;
  }

  public t(key: TranslationKey): string {
    const locale = this.locales[this.currentLang];
    if (locale && locale[key]) {
      return locale[key];
    }
    // Fallback to English if not found
    if (this.currentLang !== 'en' && this.locales['en'] && this.locales['en'][key]) {
      return this.locales['en'][key];
    }
    return key;
  }

  public subscribe(callback: () => void): void {
    this.listeners.push(callback);
  }

  public unsubscribe(callback: () => void): void {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l());
  }
}
