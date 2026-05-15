export const initialState = {
  startDate: '',
  endDate: '',
  activeCategory: null,
}

export function filtersReducer(state, action) {
  switch (action.type) {
    case 'SET_DATE_RANGE':
      return { ...state, startDate: action.start, endDate: action.end }
    case 'SET_CATEGORY':
      return { ...state, activeCategory: action.category }
    case 'RESET':
      return { ...initialState }
    default:
      return state
  }
}