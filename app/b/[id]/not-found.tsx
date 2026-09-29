import Link from "next/link";
import styles from "@/screens/wilted.module.css";

export default function Wilted() {
  return (
    <main className={styles.wilted}>
      <h1>This bouquet has wilted</h1>
      <p>We couldn’t find it. Check that the link was copied in full, or try typing the code from the tag.</p>
      <div className={styles.row}>
        <Link className={styles.button} href="/decode">
          Try the code
        </Link>
        <Link className={styles.ghost} href="/create">
          Grow a new one
        </Link>
      </div>
    </main>
  );
}
