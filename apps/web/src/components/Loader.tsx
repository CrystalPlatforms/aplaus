export function Loader() {
	return (
		<output className="uib-dot-loader" aria-label="Ładowanie">
			<div className="uib-dot" />
			<div className="uib-dot" />
			<div className="uib-dot" />
			<div className="uib-dot" />
			<div className="uib-dot" />
			<div className="uib-dot" />
			<span className="sr-only">Ładowanie…</span>

			<style>{`
        .uib-dot-loader {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          height: 40px;
          width: 40px;
          animation: uib-smoothRotate 1.80s linear infinite;
        }

        .uib-dot-loader .uib-dot {
          position: absolute;
          top: 0;
          left: 0;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          height: 100%;
          width: 100%;
          animation: uib-rotate 1s ease-in-out infinite;
        }

        .uib-dot-loader .uib-dot::before {
          content: "";
          height: 6.80px;
          width: 6.80px;
          border-radius: 50%;
          background-color: var(--aplaus-loader-blue);
        }

        .uib-dot-loader .uib-dot:nth-child(2) {
          animation-delay: -0.417s;
        }
        .uib-dot-loader .uib-dot:nth-child(3) {
          animation-delay: -0.334s;
        }
        .uib-dot-loader .uib-dot:nth-child(4) {
          animation-delay: -0.251s;
        }
        .uib-dot-loader .uib-dot:nth-child(5) {
          animation-delay: -0.167s;
        }
        .uib-dot-loader .uib-dot:nth-child(6) {
          animation-delay: -0.084s;
        }

        @keyframes uib-rotate {
          0% {
            transform: rotate(0deg);
          }
          65%,
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes uib-smoothRotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
		</output>
	);
}

/**
 * Mały wariant loadera do przycisków w trakcie akcji — ten sam pierścień
 * kropek co wyżej, 14px, ustawiany PRZED tekstem statusu. Kolory kropek
 * z klasy Tailwind bg-blue-600 — ten sam odcień co --aplaus-loader-blue
 * (r.21), stały w każdym motywie.
 */
export function ButtonSpinner() {
	return (
		<span className="btn-dot-spinner" aria-hidden="true">
			{[0, 1, 2, 3, 4, 5].map((i) => (
				<span
					key={i}
					className="btn-dot-spinner-dot size-[4px] rounded-full bg-blue-600"
					style={{ animationDelay: `${i === 0 ? 0 : -(0.5 - i * 0.0833)}s` }}
				/>
			))}
			<style>{`
        .btn-dot-spinner {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          height: 14px;
          width: 14px;
          margin-right: 6px;
          vertical-align: -2px;
          animation: btn-smoothRotate 1.8s linear infinite;
        }
        .btn-dot-spinner .btn-dot-spinner-dot {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 100%;
          animation: btn-rotate 1s ease-in-out infinite;
        }
        @keyframes btn-rotate {
          0% { transform: rotate(0deg); }
          65%, 100% { transform: rotate(360deg); }
        }
        @keyframes btn-smoothRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
		</span>
	);
}
