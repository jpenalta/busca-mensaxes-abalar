(function () {
	"use strict";

	var browser = window.browser || window.chrome || {};

	if (document.getElementById("abalar-busca-panel")) {
		return;
	}

	var STORAGE_LISTA = "abalarBuscaMensaxes";
	var STORAGE_META = "abalarBuscaMeta";

	var mensaxesGlobais = [];
	var metaGlobais = { totalPages: 1, dataCache: null };

	function limpar(s) {
		return (s || "").replace(/\s+/g, " ").trim();
	}

	function normalizar(s) {
		return limpar(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
	}

	function esc(s) {
		var div = document.createElement("div");
		div.textContent = s == null ? "" : String(s);
		return div.innerHTML;
	}

	function parseData(s) {
		if (!s) return 0;
		var m = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ ]([\d:]+))?/.exec(limpar(s));
		if (!m) return 0;
		var t = m[4] ? m[4] + ":00" : "T00:00:00";
		return new Date(m[3] + "-" + m[2] + "-" + m[1] + "T" + t).getTime() || 0;
	}

	function numeroPaxinaDesdeHref(href) {
		if (!href) return null;
		try {
			var u = new URL(href, window.location.href);
			var v = parseInt(u.searchParams.get("page"), 10);
			return isNaN(v) ? null : v;
		} catch (e) {
			var m = /[?&]page=(\d+)/.exec(href);
			return m ? parseInt(m[1], 10) : null;
		}
	}

	function totalPaxinas(doc) {
		var ultimo = doc.querySelector(".pagelinks a.goToLastPage");
		if (ultimo) {
			var v = numeroPaxinaDesdeHref(ultimo.getAttribute("href"));
			if (v) return v;
		}
		var max = 1;
		var actual = doc.querySelector(".pagelinks .currentPage");
		if (actual) {
			var n = parseInt(actual.textContent, 10);
			if (n > max) max = n;
		}
		doc.querySelectorAll(".pagelinks a").forEach(function (a) {
			var n = numeroPaxinaDesdeHref(a.getAttribute("href"));
			if (n && n > max) max = n;
		});
		return max;
	}

	function extraerMensaxes(doc) {
		var taboa = doc.querySelector("table#row") || doc.querySelector("table");
		if (!taboa) return [];
		var filas = Array.prototype.slice.call(taboa.querySelectorAll("tbody tr"));
		var resultado = [];

		filas.forEach(function (fila) {
			if (!fila.querySelector(".mensaxeBloque")) return;
			var msg = {
				codChat: "",
				tipo: "1",
				perfil: "P",
				chatActivo: "S",
				destinatario: "",
				emisor: "",
				alunos: [],
				contido: "",
				data: "",
				page: 1
			};

			var clic = fila.querySelector('[onclick*="submitForm"]');
			if (clic) {
				var mm = /\bsubmitForm\s*\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/.exec(
					clic.getAttribute("onclick")
				);
				if (mm) {
					msg.codChat = mm[1];
					msg.tipo = mm[2];
					msg.chatActivo = mm[3];
				}
			}

			var vp = fila.querySelector('[onclick*="verListadoParticipantes"]');
			if (vp) {
				var mv = /verListadoParticipantes\s*\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/.exec(
					vp.getAttribute("onclick")
				);
				if (mv) {
					msg.perfil = mv[2];
					if (!msg.codChat) msg.codChat = mv[1];
					msg.tipo = mv[3];
				}
			}

			var dest = fila.querySelector("#destinatario");
			if (dest) msg.destinatario = limpar(dest.textContent);

			var datos = fila.querySelector("#datosEmisor");
			if (datos) {
				var emisorRaw = limpar(datos.textContent);
				var partes = emisorRaw.split(/Alumno\s*:/);
				if (partes.length > 1) {
					msg.alunos.push(limpar(partes[1]));
				}
				var emisor = partes[0].replace(/\s*-\s*$/, "").trim();
				msg.emisor = emisor.replace(/^[^:]+:\s*/, "") || emisor;
			}

			var contido = fila.querySelector("#contidoMensaxe");
			if (contido) msg.contido = limpar(contido.textContent);

			var dataEl = fila.querySelector("#dataMensaxe");
			if (dataEl) msg.data = limpar(dataEl.textContent);

			var url = new URL(window.location.href);
			var pag = parseInt(url.searchParams.get("page"), 10);
			msg.page = isNaN(pag) ? 1 : pag;

			resultado.push(msg);
		});

		return resultado;
	}

	function obtenerCache() {
		return browser.storage.local.get([STORAGE_LISTA, STORAGE_META]).then(function (res) {
			return {
				mensaxes: Array.isArray(res[STORAGE_LISTA]) ? res[STORAGE_LISTA] : [],
				meta: res[STORAGE_META] || {}
			};
		});
	}

	function gardarCache(mensaxes, meta) {
		var obxecto = {};
		obxecto[STORAGE_LISTA] = mensaxes;
		obxecto[STORAGE_META] = meta;
		return browser.storage.local.set(obxecto);
	}

	function mergeMensaxes(existentes, novos) {
		var porCod = {};
		existentes.forEach(function (m) {
			if (m.codChat) porCod[m.codChat] = m;
		});
		novos.forEach(function (m) {
			if (m.codChat) porCod[m.codChat] = m;
		});
		return Object.keys(porCod).map(function (k) {
			return porCod[k];
		});
	}

	function urlPaxina(page) {
		var u = new URL(window.location.href);
		u.searchParams.set("page", String(page));
		return u.toString();
	}

	function procesarSecuencial(itens, fn, onProgreso) {
		var total = itens.length;
		var contador = 0;
		return itens.reduce(function (p, item) {
			return p
				.then(function () {
					return fn(item);
				})
				.then(function (res) {
					contador++;
					if (onProgreso) onProgreso(contador, total);
					return res;
				});
		}, Promise.resolve());
	}

	function cargarParticipantes(msg) {
		var u = new URL(window.location.origin + "/abalar/VerListaParticipantes.do");
		u.searchParams.set("DIALOG-EVENT-cargarListaParticipantes", "cargarListaParticipantes");
		u.searchParams.set("codChat", msg.codChat);
		u.searchParams.set("perfil", msg.perfil);
		return fetch(u.toString(), {
			credentials: "include",
			headers: { Accept: "application/json" }
		})
			.then(function (resp) {
				if (!resp.ok) throw new Error("Erro HTTP " + resp.status);
				return resp.json();
			})
			.then(function (data) {
				var alunos = [];
				if (data && Array.isArray(data.resultado)) {
					data.resultado.forEach(function (p) {
						if (p && p.nomeCompleto) {
							var nome = limpar(p.nomeCompleto);
							if (nome) alunos.push(nome);
						}
					});
				}
				return alunos;
			})
			.catch(function () {
				return [];
			});
	}

	function abrirConversa(msg) {
		var form = document.createElement("form");
		form.method = "post";
		form.action = window.location.origin + "/abalar/ListarMensaxesChat.do";
		form.style.display = "none";
		["codChat", "tipo", "chatActivo"].forEach(function (nome) {
			var input = document.createElement("input");
			input.type = "hidden";
			input.name = nome;
			input.value = msg[nome] || "";
			form.appendChild(input);
		});
		document.body.appendChild(form);
		form.submit();
	}

	function buscarAlumnos(consulta) {
		var q = normalizar(consulta);
		if (!q) return [];
		return mensaxesGlobais.filter(function (m) {
			return m.alunos.some(function (a) {
				return normalizar(a).indexOf(q) !== -1;
			});
		});
	}

	function formatarDataCache(iso) {
		if (!iso) return "";
		var d = new Date(iso);
		if (isNaN(d.getTime())) return "";
		return d.toLocaleDateString("gl-ES") + " " + d.toLocaleTimeString("gl-ES", {
			hour: "2-digit",
			minute: "2-digit"
		});
	}

	function renderResultados(consulta) {
		var contedor = UI.resultados;
		contedor.innerHTML = "";

		if (!consulta) {
			var baleiro = document.createElement("div");
			baleiro.className = "abp-baleiro";
			baleiro.textContent =
				"Cache: " + mensaxesGlobais.length + " mensaxes" +
				(metaGlobais && metaGlobais.dataCache
					? " (actualizada o " + formatarDataCache(metaGlobais.dataCache) + ")"
					: "") +
				". Escribe un nome de alumno/a para filtrar.";
			contedor.appendChild(baleiro);
			return;
		}

		var atinxidas = buscarAlumnos(consulta);
		UI.conta.textContent = atinxidas.length + " resultado(s)";

		if (!atinxidas.length) {
			var ningun = document.createElement("div");
			ningun.className = "abp-baleiro";
			ningun.textContent = "Ningunha mensaxe coincide con «" + consulta + "».";
			contedor.appendChild(ningun);
			return;
		}

		atinxidas
			.sort(function (a, b) {
				return parseData(b.data) - parseData(a.data);
			})
			.forEach(function (m) {
				var nodo = document.createElement("div");
				nodo.className = "abp-mensaxe";

				var cab = document.createElement("div");
				cab.className = "abp-mensaxe-cabezallo";

				var asunto = document.createElement("div");
				asunto.className = "abp-mensaxe-asunto";
				asunto.textContent = m.destinatario || "(sen asunto)";

				var data = document.createElement("div");
				data.className = "abp-mensaxe-data";
				data.textContent = m.data;

				cab.appendChild(asunto);
				cab.appendChild(data);

				var alumnos = document.createElement("div");
				alumnos.className = "abp-mensaxe-alumnos";
				alumnos.textContent = "Alumno/a: " + (m.alunos.join(" · ") || "—");

				var emisor = document.createElement("div");
				emisor.className = "abp-mensaxe-emisor";
				emisor.textContent = m.emisor ? "De: " + m.emisor : "";

				var contido = document.createElement("div");
				contido.className = "abp-mensaxe-contido";
				contido.textContent = m.contido;

				var pe = document.createElement("div");
				pe.className = "abp-mensaxe-pe";
				var abrir = document.createElement("button");
				abrir.type = "button";
				abrir.className = "abp-abrir";
				abrir.textContent = "Abrir conversa";
				abrir.addEventListener("click", function () {
					abrirConversa(m);
				});
				pe.appendChild(abrir);

				nodo.appendChild(cab);
				nodo.appendChild(alumnos);
				if (m.emisor) nodo.appendChild(emisor);
				if (m.contido) nodo.appendChild(contido);
				nodo.appendChild(pe);
				contedor.appendChild(nodo);
			});
	}

	var UI = {};

	function crearPanel() {
		var panel = document.createElement("div");
		panel.id = "abalar-busca-panel";

		var cabeceira = document.createElement("div");
		cabeceira.className = "abp-cabeceira";

		var titulo = document.createElement("span");
		titulo.className = "abp-cabeceira-titulo";
		titulo.textContent = "Busca mensaxes Abalar";

		var cachear = document.createElement("button");
		cachear.type = "button";
		cachear.className = "abp-boton";
		cachear.textContent = "Cachear páxinas";

		var limpar = document.createElement("button");
		limpar.type = "button";
		limpar.className = "abp-boton";
		limpar.textContent = "Limpar";

		var tancar = document.createElement("button");
		tancar.type = "button";
		tancar.className = "abp-boton abp-tancar";
		tancar.title = "Pechar panel";
		tancar.textContent = "×";

		cabeceira.appendChild(titulo);
		cabeceira.appendChild(cachear);
		cabeceira.appendChild(limpar);
		cabeceira.appendChild(tancar);

		var corpo = document.createElement("div");
		corpo.className = "abp-corpo";

		var busca = document.createElement("div");
		busca.className = "abp-busca";

		var input = document.createElement("input");
		input.type = "text";
		input.className = "abp-input";
		input.placeholder = "Buscar por nome de alumno/a…";
		input.autocomplete = "off";

		busca.appendChild(input);

		var estado = document.createElement("div");
		estado.className = "abp-estado";

		var pulso = document.createElement("div");
		pulso.className = "abp-pulsado";
		var pulsoBarra = document.createElement("div");
		pulsoBarra.className = "abp-pulsado-barra";
		pulso.appendChild(pulsoBarra);

		var conta = document.createElement("div");
		conta.className = "abp-conta";

		corpo.appendChild(busca);
		corpo.appendChild(estado);
		corpo.appendChild(pulso);
		corpo.appendChild(conta);

		var resultados = document.createElement("div");
		resultados.className = "abp-resultados";

		panel.appendChild(cabeceira);
		panel.appendChild(corpo);
		panel.appendChild(resultados);
		document.body.appendChild(panel);

		UI = {
			panel: panel,
			cachear: cachear,
			limpar: limpar,
			tancar: tancar,
			input: input,
			estado: estado,
			pulso: pulso,
			pulsoBarra: pulsoBarra,
			conta: conta,
			resultados: resultados
		};

		var timer = null;
		input.addEventListener("input", function () {
			clearTimeout(timer);
			timer = setTimeout(function () {
				renderResultados(input.value);
			}, 200);
		});

		tancar.addEventListener("click", function () {
			panel.remove();
		});

		cachear.addEventListener("click", cachearTodasAsPaxinas);

		limpar.addEventListener("click", function () {
			var obxectoLimpo = {};
			obxectoLimpo[STORAGE_LISTA] = [];
			obxectoLimpo[STORAGE_META] = {};
			browser.storage.local.set(obxectoLimpo).then(function () {
				mensaxesGlobais = [];
				metaGlobais = { totalPages: 1, dataCache: null };
				actualizarEstado("Cache baleira.");
				renderResultados("");
			});
		});
	}

	function actualizarEstado(texto, erro) {
		UI.estado.textContent = texto || "";
		UI.estado.classList.toggle("abp-erro", !!erro);
	}

	function amosarPulso(visibel, fraccion) {
		UI.pulso.classList.toggle("abp-visible", !!visibel);
		if (visibel) {
			UI.pulsoBarra.style.width = Math.round((fraccion || 0) * 100) + "%";
		}
	}

	var cacheando = false;

	function cachearTodasAsPaxinas() {
		if (cacheando) return;
		cacheando = true;
		UI.cachear.disabled = true;

		var total = totalPaxinas(document);
		actualizarEstado("Cacheando " + total + " páxinas…");

		obtenerCache()
			.then(function (cache) {
				var mensaxes = mergeMensaxes(cache.mensaxes || [], extraerMensaxes(document));
				var paginas = [];
				for (var i = 1; i <= total; i++) paginas.push(i);

				amosarPulso(true, 0);
				return procesarSecuencial(
					paginas,
					function (page) {
						return fetch(urlPaxina(page), {
							credentials: "include",
							headers: { "X-Requested-With": "fetch" }
						}).then(function (resp) {
							if (!resp.ok) {
								throw new Error("Erro HTTP " + resp.status + " na páxina " + page + ".");
							}
							return resp.text();
						}).then(function (html) {
							var doc = new DOMParser().parseFromString(html, "text/html");
							var novas = extraerMensaxes(doc);
							if (!novas.length) {
								throw new Error(
									"Non se atoparon mensaxes na páxina " + page +
									". Comproba que a sesión está activa."
								);
							}
							mensaxes = mergeMensaxes(mensaxes, novas);
							UI.cachear.textContent = "Cachear páxinas (" + mensaxes.length + ")";
							return mensaxes.length;
						});
					},
					function (contador, total1) {
						actualizarEstado("Páxinas cacheadas: " + contador + " / " + total1);
						amosarPulso(true, contador / total1);
					}
				).then(function () {
					var pendentes = mensaxes.filter(function (m) {
						return !m.alunos.length && (m.tipo === "2" || m.tipo === "3");
					});
					if (!pendentes.length) {
						return { mensaxes: mensaxes, pendentes: 0 };
					}
					actualizarEstado("Cargando participantes de " + pendentes.length + " difusión(s)…");
					return procesarSecuencial(
						pendentes,
						function (m) {
							return cargarParticipantes(m).then(function (alunos) {
								m.alunos = alunos;
							});
						},
						function (contador, total1) {
							actualizarEstado(
								"Participantes: " + contador + " / " + total1
							);
							amosarPulso(true, contador / total1);
						}
					).then(function () {
						return { mensaxes: mensaxes, pendentes: pendentes.length };
					});
				}).then(function (info) {
					mensaxesGlobais = info.mensaxes;
					metaGlobais = { totalPages: total, dataCache: new Date().toISOString() };
					return gardarCache(mensaxesGlobais, metaGlobais);
				});
			})
			.then(function () {
				actualizarEstado(
					"Cache actualizada: " + mensaxesGlobais.length + " mensaxes en " +
					metaGlobais.totalPages + " páxinas."
				);
				renderResultados(UI.input.value);
			})
			.catch(function (err) {
				actualizarEstado("Erro: " + (err && err.message ? err.message : err), true);
			})
			.then(function () {
				amosarPulso(false);
				cacheando = false;
				UI.cachear.disabled = false;
			});
	}

	function init() {
		crearPanel();
		obtenerCache()
			.then(function (cache) {
				var actuais = extraerMensaxes(document);
				mensaxesGlobais = mergeMensaxes(cache.mensaxes || [], actuais);
				metaGlobais = cache.meta || { totalPages: 1, dataCache: null };
				if (!metaGlobais.totalPages) metaGlobais.totalPages = totalPaxinas(document);
				return gardarCache(mensaxesGlobais, metaGlobais);
			})
			.then(function () {
				UI.cachear.textContent = "Cachear páxinas (" + metaGlobais.totalPages + ")";
				var datos = metaGlobais.dataCache
					? " · última actualización: " + formatarDataCache(metaGlobais.dataCache)
					: " · aínda sen actualizar (pulsa Cachear páxinas)";
				actualizarEstado(
					mensaxesGlobais.length + " mensaxes en cache" + datos
				);
				renderResultados("");
			})
			.catch(function () {
				actualizarEstado("Non se puido ler o almacenamento local.", true);
			});
	}

	init();
})();