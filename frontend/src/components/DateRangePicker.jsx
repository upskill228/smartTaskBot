export default function DateRangePicker({ startDate, endDate, onDateChange }) {
  return (
    <div className="date-range-picker">
      <label>
        De:
        <input
          type="date"
          value={startDate}
          onChange={(e) => onDateChange(e.target.value, endDate)} // este componente não guarda estado, ele recebe os valores e a função para atualizar do componente pai (lifting state up)
        />
      </label>
      <label>
        Até:
        <input
          type="date"
          value={endDate}
          onChange={(e) => onDateChange(startDate, e.target.value)} 
        />
      </label>
    </div>
  )
}