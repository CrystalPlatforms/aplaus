/**
 * Pull-to-refresh: pociągnięcie w dół na górze strony (scrollY = 0)
 * odświeża dane. Zwraca postęp pociągnięcia (0..1) i stan odświeżania —
 * AppShell renderuje wskaźnik z kropek loadera (te same niebieskie kropki,
 * decyzja r.21). Dotyk tylko: mysz nie wywołuje odświeżania.
 */
import { useEffect, useRef, useState } from "react";

/** Pociągnięcie ≤ 70 px sygnalizuje gotowość; puść, aby odświeżyć. */
const THRESHOLD = 70;
const MAX_PULL = 110;
/** Opór: palec przesuwa się szybciej niż wskaźnik (HIG rubber-band). */
const RESISTANCE = 0.45;

export function usePullToRefresh(onRefresh: () => Promise<unknown>): {
	progress: number;
	refreshing: boolean;
} {
	const [progress, setProgress] = useState(0);
	const [refreshing, setRefreshing] = useState(false);
	const refreshingRef = useRef(false);

	useEffect(() => {
		refreshingRef.current = refreshing;
	}, [refreshing]);

	useEffect(() => {
		let startY: number | null = null;
		let distance = 0;

		const onTouchStart = (event: TouchEvent) => {
			if (refreshingRef.current || window.scrollY > 0) return;
			const touch = event.touches[0];
			if (!touch) return;
			startY = touch.clientY;
			distance = 0;
		};

		const onTouchMove = (event: TouchEvent) => {
			if (startY === null || refreshingRef.current) return;
			const touch = event.touches[0];
			if (!touch) return;
			const delta = touch.clientY - startY;
			if (delta <= 0) {
				distance = 0;
				setProgress(0);
				return;
			}
			distance = Math.min(MAX_PULL, delta * RESISTANCE);
			setProgress(Math.min(1, distance / THRESHOLD));
			// Tylko przy pociąganiu w dół z góry: blokuje natywny odbicie-scroll,
			// żeby wskaźnik był jedyną odpowiedzią na gest.
			event.preventDefault();
		};

		const onTouchEnd = () => {
			if (startY === null) return;
			startY = null;
			if (distance >= THRESHOLD) {
				setRefreshing(true);
				setProgress(1);
				void Promise.resolve(onRefresh()).finally(() => {
					setRefreshing(false);
					setProgress(0);
				});
			} else {
				setProgress(0);
			}
			distance = 0;
		};

		window.addEventListener("touchstart", onTouchStart, { passive: true });
		window.addEventListener("touchmove", onTouchMove, { passive: false });
		window.addEventListener("touchend", onTouchEnd);
		return () => {
			window.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchmove", onTouchMove);
			window.removeEventListener("touchend", onTouchEnd);
		};
	}, [onRefresh]);

	return { progress, refreshing };
}
