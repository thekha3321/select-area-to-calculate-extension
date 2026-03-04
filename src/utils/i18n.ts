export type Lang = 'en' | 'vi'

export const translations = {
  en: {
    title:            'Table Calculator',
    hint:             'Select an area on the page that contains numbers.',
    selectArea:       '📷 Select Area',
    drawing:          'Draw a rectangle over the table on the page.',
    pressEsc:         'Press ESC to cancel',
    runningOCR:       'Running OCR…',
    extractedNumbers: 'Extracted Numbers',
    customFormula:    'Custom Formula',
    formulaHint:      'Use:',
    formulaPlaceholder: 'e.g. SUM * 0.1  or  MAX - MIN',
    noNumbers:        'No numbers found. Try selecting a clearer area.',
    tryAgain:         'Try Again',
    newCapture:       '📷 New Capture',
    reset:            'Reset',
    sum:              'Sum',
    average:          'Average',
    min:              'Min',
    max:              'Max',
    captureFailed:    'Capture failed',
  },
  vi: {
    title:            'Máy Tính Bảng',
    hint:             'Chọn một vùng trên trang có chứa số.',
    selectArea:       '📷 Chọn Vùng',
    drawing:          'Kéo chọn vùng bảng trên trang.',
    pressEsc:         'Nhấn ESC để hủy',
    runningOCR:       'Đang nhận dạng…',
    extractedNumbers: 'Các Số Đã Trích Xuất',
    customFormula:    'Công Thức Tùy Chỉnh',
    formulaHint:      'Dùng:',
    formulaPlaceholder: 'VD: SUM * 0.1  hoặc  MAX - MIN',
    noNumbers:        'Không tìm thấy số. Thử chọn vùng rõ hơn.',
    tryAgain:         'Thử Lại',
    newCapture:       '📷 Chụp Mới',
    reset:            'Đặt Lại',
    sum:              'Tổng',
    average:          'Trung Bình',
    min:              'Nhỏ Nhất',
    max:              'Lớn Nhất',
    captureFailed:    'Chụp Thất Bại',
  },
} satisfies Record<Lang, Record<string, string>>

export function getSavedLang(): Lang {
  const v = localStorage.getItem('lang')
  return v === 'vi' ? 'vi' : 'en'
}

export function saveLang(lang: Lang) {
  localStorage.setItem('lang', lang)
}
