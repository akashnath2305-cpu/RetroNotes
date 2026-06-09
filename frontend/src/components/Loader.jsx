import React from 'react'

export default function Loader({ text = "Opening Notebook..." }) {
  return (
    <div className="loader-overlay">
      <div className="loader-book">
        <div className="loader-page"></div>
      </div>
      <div className="loader-text">{text}</div>
    </div>
  )
}
