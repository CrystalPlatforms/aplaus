/**
 * Login banner: "<imię nazwisko>" + rola. Shown in the shell header —
 * after login, after switching accounts and after a silent renewal (the three
 * moments when the account context is (re)established).
 */
export function LoginBanner({
	firstName,
	lastName,
	roleLabel,
}: {
	firstName: string;
	lastName: string;
	roleLabel: string;
}) {
	const name = `${firstName} ${lastName}`.trim();
	return (
		<div className="min-w-0" data-testid="login-banner">
			<p className="text-sm font-semibold truncate">{name}</p>
			{roleLabel && (
				<p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{roleLabel}</p>
			)}
		</div>
	);
}
