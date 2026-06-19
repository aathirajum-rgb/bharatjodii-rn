// Shape of a single filter/search dropdown field
// Angular had isSelected: 0 (wrong type) — fixed to boolean here
export interface ISearchList {
  fieldType: string
  labelName: string
  selectedData: string
  imgUrl: string
  isSelected: boolean
  isShowSearch: boolean
  isAnyChanges: boolean
}
